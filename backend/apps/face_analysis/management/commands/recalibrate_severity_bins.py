"""신규 Ridge 회귀 redness_score용 4단계 등급(정상/경미/중등도/심함) 경계 재보정.

    python manage.py recalibrate_severity_bins

analysis.py의 SEVERITY_BINS(20/40/65)는 예전 규칙 기반 점수(a* 채널 하나를
선형 재조정한 값)의 분포에 맞춰 잡은 경계라, 분포가 훨씬 좁은(평균 33.7,
표준편차 5.2) 신규 Ridge 회귀 redness_score에는 안 맞는다 -- 대부분 20~40
사이(mild)에 몰려서 4단계 일치율이 35%->26%로 떨어졌다(analysis.py 주석 참고).

SEVERITY_BINS 자체는 "Kaggle 라벨 점수(0/20/40/60/80/100) -> 정답 등급"에도
같이 쓰이고 있어서 그대로 두고, 이 커맨드는 "모델 예측 점수 -> 등급"에만 쓸
새 경계(MODEL_SEVERITY_BINS)를 train split에서 찾는다. 정렬된 예측 점수를
4개의 연속 구간(정상/경미/중등도/심함, 순서 고정)으로 나눠 정답과의 일치
개수를 최대화하는 절단점 2개를 정확 탐색(DP)으로 찾고, valid split(학습에
전혀 안 씀)에서 최종 정확도를 보고한다 -- train_redness_regression.py와
동일한 train/valid 분리 원칙.
"""

import hashlib
from pathlib import Path

import numpy as np
import openpyxl
from django.core.management.base import BaseCommand

from apps.face_analysis.analysis import NoFaceDetectedError, _severity_from_score, analyze_face_redness

DEFAULT_DATASET_DIR = Path('/Users/suin/Downloads/skin_type_classification_dataset')
LABEL_FILES = {
    'train': 'skinalaysis_labeling_train1.xlsx',
    'valid': 'skinanalysis_valid1.xlsx',
}
LABEL_COLUMN = 'Redness Severity (0-5)'
SEVERITY_ORDER = ('normal', 'mild', 'moderate', 'severe')

# 라벨(정답) 점수 -> 등급 매핑은 analysis.py의 _severity_from_score(SEVERITY_BINS 기반)를
# 그대로 재사용한다 -- 이 파일에서 찾는 건 예측 점수용 경계(MODEL_SEVERITY_BINS)뿐이고,
# 라벨 쪽 정답 매핑은 절대 건드리지 않아야 한다(analysis.py 주석 참고).
_severity_from_label_score = _severity_from_score


class Command(BaseCommand):
    help = '신규 Ridge redness_score 분포에 맞는 4단계 등급 경계를 train split에서 찾고 valid로 검증'

    def add_arguments(self, parser):
        parser.add_argument('--dataset-dir', default=str(DEFAULT_DATASET_DIR))

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
            label_score = item['label_0_5'] * 20
            rows.append({
                **item,
                'pred_score': result['redness_score'],
                'label_score': label_score,
                'true_severity': _severity_from_label_score(label_score),
            })
        self.stdout.write(f'분석 성공 {len(rows)}장 / 실패 {failures}장')

        train_rows = [r for r in rows if r['split'] == 'train']
        valid_rows = [r for r in rows if r['split'] == 'valid']
        self.stdout.write(f'train {len(train_rows)}장(경계 탐색용) / valid {len(valid_rows)}장(평가 전용)\n')

        # --- 기존 경계(SEVERITY_BINS)를 신규 모델 점수에 그대로 썼을 때 (현재 프로덕션 상태) ---
        old_train_acc = self._accuracy(train_rows, _severity_from_label_score)
        old_valid_acc = self._accuracy(valid_rows, _severity_from_label_score)
        self.stdout.write(self.style.WARNING(
            f'[재보정 전] 기존 SEVERITY_BINS(20/40/65)를 모델 점수에 그대로 적용: '
            f'train {old_train_acc[0]}/{old_train_acc[1]} ({old_train_acc[2]:.0f}%), '
            f'valid {old_valid_acc[0]}/{old_valid_acc[1]} ({old_valid_acc[2]:.0f}%)'
        ))

        # --- train에서 절단점 2개(4구간) 최적 탐색 ---
        t1, t2, t3 = self._optimal_thresholds(train_rows)
        new_bins = ((t1, 'normal'), (t2, 'mild'), (t3, 'moderate'))

        def classify(score):
            for threshold, label in new_bins:
                if score < threshold:
                    return label
            return 'severe'

        new_train_acc = self._accuracy(train_rows, classify)
        new_valid_acc = self._accuracy(valid_rows, classify)
        self.stdout.write(self.style.SUCCESS(
            f'\n[재보정 후] 새 경계 {t1:.1f}/{t2:.1f}/{t3:.1f}: '
            f'train {new_train_acc[0]}/{new_train_acc[1]} ({new_train_acc[2]:.0f}%), '
            f'valid {new_valid_acc[0]}/{new_valid_acc[1]} ({new_valid_acc[2]:.0f}%)'
        ))

        self.stdout.write('\nvalid 혼동행렬 (행=라벨, 열=재보정된 예측)')
        matrix = {actual: {p: 0 for p in SEVERITY_ORDER} for actual in SEVERITY_ORDER}
        for r in valid_rows:
            matrix[r['true_severity']][classify(r['pred_score'])] += 1
        col_header = f"{'label \\ pred':<14}" + ''.join(f"{p:<10}" for p in SEVERITY_ORDER)
        self.stdout.write(col_header)
        for actual in SEVERITY_ORDER:
            row = f"{actual:<14}" + ''.join(f"{matrix[actual][p]:<10}" for p in SEVERITY_ORDER)
            self.stdout.write(row)

        self.stdout.write(self.style.SUCCESS(
            f"\n=== analysis.py에 붙여넣을 상수 ===\n"
            f"MODEL_SEVERITY_BINS = (\n"
            f"    ({t1:.1f}, 'normal'),\n"
            f"    ({t2:.1f}, 'mild'),\n"
            f"    ({t3:.1f}, 'moderate'),\n"
            f")"
        ))

    def _accuracy(self, rows, classify_fn):
        matches = sum(1 for r in rows if classify_fn(r['pred_score']) == r['true_severity'])
        total = len(rows)
        pct = 100 * matches / total if total else 0.0
        return matches, total, pct

    def _optimal_thresholds(self, rows):
        """정렬된 예측 점수를 4개의 연속 구간(등급 순서 고정)으로 나눠 정답 일치 개수를
        최대화하는 절단점 2개를 DP로 정확히 찾는다. n이 작아(train ~150장) O(n^2 * 4)로 충분."""
        order = np.argsort([r['pred_score'] for r in rows], kind='mergesort')
        sorted_rows = [rows[i] for i in order]
        scores = [r['pred_score'] for r in sorted_rows]
        classes = [SEVERITY_ORDER.index(r['true_severity']) for r in sorted_rows]
        n = len(sorted_rows)

        # prefix_count[c][i] = 정답 클래스가 c인 샘플이 앞 i개(정렬 기준) 안에 몇 개인지
        prefix_count = [[0] * (n + 1) for _ in range(4)]
        for i in range(n):
            for c in range(4):
                prefix_count[c][i + 1] = prefix_count[c][i] + (1 if classes[i] == c else 0)

        def seg_matches(start, end, cls):
            return prefix_count[cls][end] - prefix_count[cls][start]

        NEG = float('-inf')
        # dp[k][i]: 앞 i개를 "구간 0..k-1"(등급 순서 고정)로 나눴을 때 최대 일치 수
        dp = [[NEG] * (n + 1) for _ in range(5)]
        back = [[0] * (n + 1) for _ in range(5)]
        dp[0][0] = 0
        for k in range(1, 5):
            for i in range(0, n + 1):
                best, best_j = NEG, 0
                for j in range(0, i + 1):
                    if dp[k - 1][j] == NEG:
                        continue
                    val = dp[k - 1][j] + seg_matches(j, i, k - 1)
                    if val > best:
                        best, best_j = val, j
                dp[k][i] = best
                back[k][i] = best_j

        # 경계 4개 구간이 전부 n개를 다 써야 함(dp[4][n])
        cuts = []
        i, k = n, 4
        while k > 0:
            j = back[k][i]
            cuts.append(j)
            i, k = j, k - 1
        cuts.reverse()  # [0, cut1, cut2, n]

        def boundary_score(idx):
            # idx번째(0-base) 뒤에서 자름 -> idx-1번째와 idx번째 점수 사이의 중간값
            if idx <= 0:
                return scores[0] - 1.0
            if idx >= n:
                return scores[-1] + 1.0
            return (scores[idx - 1] + scores[idx]) / 2

        # cuts == [0, normal/mild 경계, mild/moderate 경계, moderate/severe 경계] (역순으로 쌓은 뒤 reverse)
        t1 = boundary_score(cuts[1])
        t2 = boundary_score(cuts[2])
        t3 = boundary_score(cuts[3])
        return t1, t2, t3

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
