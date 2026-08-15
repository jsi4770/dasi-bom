"""A_CHANNEL_LOW/HIGH 를 Kaggle skin_type_classification_dataset 라벨로 재피팅.

    python manage.py fit_a_channel_calibration

analysis.py 의 A_CHANNEL_LOW/HIGH 는 원래 자체 라벨링한 사진 7장(n=7)으로 최소자승
피팅한 값이다. `benchmark_redness_severity_dataset` 로 194장짜리 Kaggle 라벨에 돌려본
결과가 Pearson r=0.224 로 약한 상관 — 다만 A_CHANNEL_LOW/HIGH 는 원시 a* 평균에 대한
선형 재조정(스케일+오프셋)일 뿐이라 재피팅해도 r 자체는 거의 안 바뀐다(선형 변환에 불변).
바뀌는 건 과소평가 편향(MAE)과 등급 경계 위치다.

analyze_face_redness() 가 이미 region_raw_index(클리핑 전 원시 a* 평균)를 결과에
포함해서 돌려주므로, 이걸 라벨과 최소자승 피팅해 새 A_CHANNEL_LOW/HIGH 를 구한다.
계산만 하고 analysis.py 는 직접 고치지 않는다 — 값은 사람이 검토 후 반영.
"""

from pathlib import Path

import numpy as np
import openpyxl
from django.core.management.base import BaseCommand

from apps.face_analysis.analysis import (
    A_CHANNEL_HIGH,
    A_CHANNEL_LOW,
    NoFaceDetectedError,
    analyze_face_redness,
)

DEFAULT_DATASET_DIR = Path('/Users/suin/Downloads/skin_type_classification_dataset')
LABEL_FILES = {
    'train': 'skinalaysis_labeling_train1.xlsx',
    'valid': 'skinanalysis_valid1.xlsx',
}
LABEL_COLUMN = 'Redness Severity (0-5)'


class Command(BaseCommand):
    help = 'Kaggle 라벨로 A_CHANNEL_LOW/HIGH 를 재피팅하고 기존 값과 비교 출력한다.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset-dir', default=str(DEFAULT_DATASET_DIR))
        parser.add_argument('--splits', default='train,valid')

    def handle(self, *args, **options):
        dataset_dir = Path(options['dataset_dir'])
        splits = [s.strip() for s in options['splits'].split(',') if s.strip()]

        items = self._load_labels(dataset_dir, splits)
        items = self._dedupe(items)
        self.stdout.write(f'라벨 {len(items)}장 로드')

        raw_indices = []
        labels = []
        failures = 0
        for item in items:
            with item['path'].open('rb') as f:
                try:
                    result = analyze_face_redness(f)
                except NoFaceDetectedError:
                    failures += 1
                    continue
            raw = float(np.mean(list(result['region_raw_index'].values())))
            raw_indices.append(raw)
            labels.append(item['label_0_5'] * 20)

        self.stdout.write(f'분석 성공 {len(raw_indices)}장 / 실패 {failures}장')

        x = np.array(raw_indices)
        y = np.array(labels)
        slope, intercept = np.polyfit(x, y, 1)  # y ~= slope * x + intercept

        # score = clip((raw - LOW) / (HIGH - LOW) * 100, 0, 100)
        #       = (100/(HIGH-LOW)) * raw - (100*LOW/(HIGH-LOW))
        # slope = 100/(HIGH-LOW), intercept = -slope * LOW
        new_high_minus_low = 100 / slope
        new_low = -intercept / slope
        new_high = new_low + new_high_minus_low

        pred_before = np.clip((x - A_CHANNEL_LOW) / (A_CHANNEL_HIGH - A_CHANNEL_LOW) * 100, 0, 100)
        pred_after = np.clip((x - new_low) / (new_high - new_low) * 100, 0, 100)

        def stats(pred, label):
            err = pred - label
            mae = float(np.mean(np.abs(err)))
            rmse = float(np.sqrt(np.mean(err ** 2)))
            r = float(np.corrcoef(pred, label)[0, 1])
            return mae, rmse, r

        mae_b, rmse_b, r_b = stats(pred_before, y)
        mae_a, rmse_a, r_a = stats(pred_after, y)

        self.stdout.write(self.style.SUCCESS('\n=== 재피팅 결과 ==='))
        self.stdout.write(f'기존: A_CHANNEL_LOW = {A_CHANNEL_LOW}, A_CHANNEL_HIGH = {A_CHANNEL_HIGH}')
        self.stdout.write(f'신규: A_CHANNEL_LOW = {new_low:.2f}, A_CHANNEL_HIGH = {new_high:.2f}')
        self.stdout.write(f'\n{"":10} {"MAE":>8} {"RMSE":>8} {"Pearson r":>10}')
        self.stdout.write(f'{"기존":10} {mae_b:8.1f} {rmse_b:8.1f} {r_b:10.3f}')
        self.stdout.write(f'{"신규":10} {mae_a:8.1f} {rmse_a:8.1f} {r_a:10.3f}')

    def _load_labels(self, dataset_dir, splits):
        items = []
        for split in splits:
            xlsx_path = dataset_dir / LABEL_FILES[split]
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
                items.append({'path': path, 'label_0_5': float(label)})
        return items

    def _dedupe(self, items):
        import hashlib
        seen = {}
        for item in items:
            digest = hashlib.md5(item['path'].read_bytes()).hexdigest()
            seen.setdefault(digest, item)
        return list(seen.values())
