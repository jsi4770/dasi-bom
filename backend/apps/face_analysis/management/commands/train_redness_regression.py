"""Kaggle train split로 진짜 회귀 모델을 학습하고 valid split으로 평가.

    python manage.py train_redness_regression

지금 파이프라인(analyze_face_redness)은 a* 채널 평균 하나를 상수 2개(A_CHANNEL_LOW/HIGH)로
선형 재조정할 뿐이라 Kaggle 194장 기준 Pearson r=0.22 에서 못 벗어난다. 클래스별로 뜯어보면
oily 서브셋만 r~0.4 고 dry/normal 은 거의 무상관이었다 -- a* 신호 하나가 홍조와 피지 반사를
구분 못 하고 있다는 뜻. 이 커맨드는 region별 a*/b*/L*/하이라이트 비율(analysis.py 의
region_extra_features, analyze_face_redness() 를 건드리지 않고 추가된 부가 출력) +
피부 타입 원핫을 피처로 써서 Ridge 회귀를 train(150장)으로 학습하고 valid(50장, 학습에
전혀 안 씀)로 평가한다. 규제 강도(lambda)는 train 내부 5-fold CV로만 고르고, valid는
최종 평가에만 한 번 쓴다 -- valid로 lambda를 고르면 곧 valid로 학습하는 것과 같아서 안 됨.

기존 규칙 기반 redness_score(a* 채널만 사용)를 같은 valid 이미지들로 다시 계산해
나란히 비교한다.
"""

import hashlib
from pathlib import Path

import numpy as np
import openpyxl
from django.core.management.base import BaseCommand

from apps.face_analysis.analysis import NoFaceDetectedError, analyze_face_redness

DEFAULT_DATASET_DIR = Path('/Users/suin/Downloads/skin_type_classification_dataset')
LABEL_FILES = {
    'train': 'skinalaysis_labeling_train1.xlsx',
    'valid': 'skinanalysis_valid1.xlsx',
}
LABEL_COLUMN = 'Redness Severity (0-5)'

REGION_NAMES = ('forehead', 'nose', 'left_cheek', 'right_cheek')
SKIN_CLASSES = ('dry', 'normal', 'oily')
LAMBDA_GRID = (0.1, 0.3, 1, 3, 10, 30, 100, 300)


class Command(BaseCommand):
    help = 'Kaggle train split로 홍조 회귀 모델을 학습하고 valid split으로 규칙 기반 방식과 비교한다.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset-dir', default=str(DEFAULT_DATASET_DIR))
        parser.add_argument(
            '--include-skin-type', action='store_true',
            help=(
                '피부 타입(dry/normal/oily) 원핫을 피처에 포함. Kaggle 폴더 라벨에서만 '
                '나오는 값이라, 업로드 시점에 유저의 피부 타입을 실제로 아는 경로(온보딩 '
                '설문 저장 등)가 생기기 전까지는 켜지 말 것 -- 학습 때만 있고 추론 때 없는 '
                '피처를 쓰면 여기서 잰 성능이 프로덕션에서 재현 안 됨.'
            ),
        )

    def handle(self, *args, **options):
        dataset_dir = Path(options['dataset_dir'])
        items = self._dedupe(self._load_labels(dataset_dir))
        self.stdout.write(f'라벨 {len(items)}장 로드')

        rows = []
        failures = 0
        for item in items:
            with item['path'].open('rb') as f:
                try:
                    result = analyze_face_redness(f)
                except NoFaceDetectedError:
                    failures += 1
                    continue
            rows.append({**item, 'result': result})
        self.stdout.write(f'분석 성공 {len(rows)}장 / 실패 {failures}장')

        train_rows = [r for r in rows if r['split'] == 'train']
        valid_rows = [r for r in rows if r['split'] == 'valid']
        self.stdout.write(f'train {len(train_rows)}장 / valid {len(valid_rows)}장 (valid는 평가 전용, 학습에 안 씀)')

        include_skin_type = options['include_skin_type']
        feature_names, X_train_raw = self._build_features(train_rows, include_skin_type)
        _, X_valid_raw = self._build_features(valid_rows, include_skin_type)
        y_train = np.array([r['label_0_5'] for r in train_rows]) * 20
        y_valid = np.array([r['label_0_5'] for r in valid_rows]) * 20
        baseline_valid = np.array([r['result']['redness_score'] for r in valid_rows])
        baseline_train = np.array([r['result']['redness_score'] for r in train_rows])

        col_mean = np.nanmean(X_train_raw, axis=0)
        X_train = np.where(np.isnan(X_train_raw), col_mean, X_train_raw)
        X_valid = np.where(np.isnan(X_valid_raw), col_mean, X_valid_raw)

        mu, sigma = X_train.mean(axis=0), X_train.std(axis=0)
        sigma = np.where(sigma < 1e-6, 1.0, sigma)
        X_train_std = (X_train - mu) / sigma
        X_valid_std = (X_valid - mu) / sigma

        y_mean = y_train.mean()
        best_lambda = self._pick_lambda_by_cv(X_train_std, y_train - y_mean)
        w = self._ridge_fit(X_train_std, y_train - y_mean, best_lambda)

        pred_train = X_train_std @ w + y_mean
        pred_valid = X_valid_std @ w + y_mean

        self.stdout.write(self.style.SUCCESS(f'\n선택된 lambda (train 5-fold CV): {best_lambda}'))
        self.stdout.write('\n계수 (표준화된 피처 기준, 절대값 큰 순):')
        for name, coef in sorted(zip(feature_names, w), key=lambda t: -abs(t[1]))[:10]:
            self.stdout.write(f'  {name:<22} {coef:+.2f}')

        self.stdout.write(self.style.SUCCESS('\n=== valid split (50장, 학습에 전혀 안 쓴 홀드아웃) ==='))
        self._print_comparison('기존 규칙 기반 (a* 1채널)', baseline_valid, y_valid)
        self._print_comparison('신규 Ridge 회귀', pred_valid, y_valid)

        self.stdout.write('\n(참고) train self-fit:')
        self._print_comparison('기존 규칙 기반', baseline_train, y_train, indent=True)
        self._print_comparison('신규 Ridge 회귀', pred_train, y_train, indent=True)

        self.stdout.write('\nvalid 피부타입별 신규 모델 Pearson r:')
        for cls in SKIN_CLASSES:
            idx = [i for i, r in enumerate(valid_rows) if r['class'] == cls]
            if len(idx) > 1:
                r = float(np.corrcoef(pred_valid[idx], y_valid[idx])[0, 1])
                self.stdout.write(f'  {cls:<8} n={len(idx):<3} r={r:.3f}')

        self.stdout.write(self.style.SUCCESS('\n=== analysis.py 에 그대로 붙여넣을 상수 ==='))
        self.stdout.write(f'REDNESS_MODEL_FEATURES = {feature_names!r}')
        self.stdout.write(f'REDNESS_MODEL_IMPUTE = {[round(float(v), 4) for v in col_mean]!r}')
        self.stdout.write(f'REDNESS_MODEL_MU = {[round(float(v), 4) for v in mu]!r}')
        self.stdout.write(f'REDNESS_MODEL_SIGMA = {[round(float(v), 4) for v in sigma]!r}')
        self.stdout.write(f'REDNESS_MODEL_WEIGHTS = {[round(float(v), 5) for v in w]!r}')
        self.stdout.write(f'REDNESS_MODEL_INTERCEPT = {round(float(y_mean), 4)}')

    def _print_comparison(self, label, pred, actual, indent=False):
        err = pred - actual
        mae = float(np.mean(np.abs(err)))
        rmse = float(np.sqrt(np.mean(err ** 2)))
        r = float(np.corrcoef(pred, actual)[0, 1])
        prefix = '  ' if indent else ''
        self.stdout.write(f'{prefix}{label:<28} MAE={mae:5.1f}  RMSE={rmse:5.1f}  Pearson r={r:.3f}')

    def _build_features(self, rows, include_skin_type):
        names = []
        for region in REGION_NAMES:
            names += [f'{region}_a', f'{region}_b', f'{region}_l', f'{region}_highlight']
        if include_skin_type:
            names += [f'skin_{c}' for c in SKIN_CLASSES]
        names += ['num_excluded', 'lighting_corrected']

        matrix = np.full((len(rows), len(names)), np.nan)
        for i, row in enumerate(rows):
            result = row['result']
            raw = result['region_raw_index']
            extra = result['region_extra_features']
            for j, region in enumerate(REGION_NAMES):
                base = j * 4
                if region in raw:
                    matrix[i, base + 0] = raw[region]
                    matrix[i, base + 1] = extra[region]['b']
                    matrix[i, base + 2] = extra[region]['l']
                    matrix[i, base + 3] = extra[region]['highlight_ratio']
            col = 16
            if include_skin_type:
                for k, cls in enumerate(SKIN_CLASSES):
                    matrix[i, col + k] = 1.0 if row['class'] == cls else 0.0
                col += len(SKIN_CLASSES)
            matrix[i, col] = float(len(result['excluded_regions']))
            matrix[i, col + 1] = 1.0 if result['lighting_corrected'] else 0.0
        return names, matrix

    def _ridge_fit(self, X, y, lam):
        n_features = X.shape[1]
        return np.linalg.solve(X.T @ X + lam * np.eye(n_features), X.T @ y)

    def _pick_lambda_by_cv(self, X, y, k=5, seed=20260815):
        rng = np.random.RandomState(seed)
        n = X.shape[0]
        order = rng.permutation(n)
        folds = np.array_split(order, k)

        best_lambda, best_mae = None, np.inf
        for lam in LAMBDA_GRID:
            maes = []
            for i in range(k):
                val_idx = folds[i]
                train_idx = np.concatenate([folds[j] for j in range(k) if j != i])
                w = self._ridge_fit(X[train_idx], y[train_idx], lam)
                pred = X[val_idx] @ w
                maes.append(np.mean(np.abs(pred - y[val_idx])))
            mean_mae = float(np.mean(maes))
            if mean_mae < best_mae:
                best_mae, best_lambda = mean_mae, lam
        return best_lambda

    def _load_labels(self, dataset_dir):
        items = []
        for split, xlsx_name in LABEL_FILES.items():
            xlsx_path = dataset_dir / xlsx_name
            wb = openpyxl.load_workbook(xlsx_path, read_only=True)
            ws = wb.active
            rows_iter = ws.iter_rows(values_only=True)
            header = next(rows_iter)
            label_idx = header.index(LABEL_COLUMN)
            id_idx = header.index('Image_ID')

            for row in rows_iter:
                image_id = row[id_idx]
                label = row[label_idx]
                if image_id is None or label is None:
                    continue
                filename = image_id if str(image_id).lower().endswith('.jpg') else f'{image_id}.jpg'
                skin_class = filename.split('_', 1)[0]
                path = dataset_dir / split / skin_class / filename
                if not path.is_file():
                    continue
                items.append({'path': path, 'split': split, 'class': skin_class, 'label_0_5': float(label)})
        return items

    def _dedupe(self, items):
        seen = {}
        for item in items:
            digest = hashlib.md5(item['path'].read_bytes()).hexdigest()
            seen.setdefault(digest, item)
        return list(seen.values())
