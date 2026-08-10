import hashlib
import time
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


class Command(BaseCommand):
    help = (
        'Benchmark analyze_face_redness() against the Kaggle skin_type_classification_dataset, '
        'which ships real "Redness Severity (0-5)" labels for its dry/oily/normal train+valid '
        'images (the combination class and the test split have no redness labels, so they are '
        'skipped). Scales the 0-5 label to the 0-100 range analyze_face_redness() returns and '
        'reports MAE, correlation, and a severity-bucket confusion matrix.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dataset-dir', default=str(DEFAULT_DATASET_DIR), help='skin_type_classification_dataset root')
        parser.add_argument('--splits', default='train,valid', help='Comma-separated splits to include (train,valid)')

    def handle(self, *args, **options):
        dataset_dir = Path(options['dataset_dir'])
        splits = [s.strip() for s in options['splits'].split(',') if s.strip()]

        labeled = self._load_labels(dataset_dir, splits)
        if not labeled:
            self.stderr.write(self.style.ERROR('라벨링된 이미지를 찾지 못했습니다.'))
            return

        unique = self._dedupe(labeled)
        skipped = len(labeled) - len(unique)

        rows = [self._run_one(item) for item in unique]

        self._print_per_image(rows, skipped)
        self._print_overall(rows)
        self._print_by_class(rows)

    def _load_labels(self, dataset_dir, splits):
        items = []
        for split in splits:
            xlsx_name = LABEL_FILES.get(split)
            if xlsx_name is None:
                self.stderr.write(self.style.WARNING(f'알 수 없는 split: {split} (건너뜀)'))
                continue
            xlsx_path = dataset_dir / xlsx_name
            if not xlsx_path.is_file():
                self.stderr.write(self.style.WARNING(f'라벨 파일 없음: {xlsx_path} (건너뜀)'))
                continue

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
                    self.stderr.write(self.style.WARNING(f'파일 없음, 건너뜀: {path}'))
                    continue
                items.append({'path': path, 'split': split, 'class': skin_class, 'label_0_5': float(label)})
        return items

    def _dedupe(self, items):
        seen = {}
        for item in items:
            digest = hashlib.md5(item['path'].read_bytes()).hexdigest()
            seen.setdefault(digest, item)
        return list(seen.values())

    def _run_one(self, item):
        label_score = item['label_0_5'] * 20  # 0-5 -> 0-100, same scale as redness_score
        with item['path'].open('rb') as image_file:
            start = time.perf_counter()
            try:
                result = analyze_face_redness(image_file)
                elapsed_ms = (time.perf_counter() - start) * 1000
                return {
                    **item,
                    'ok': True,
                    'elapsed_ms': elapsed_ms,
                    'label_score': label_score,
                    'label_severity': _severity_from_score(label_score),
                    **result,
                }
            except NoFaceDetectedError as exc:
                elapsed_ms = (time.perf_counter() - start) * 1000
                return {
                    **item,
                    'ok': False,
                    'elapsed_ms': elapsed_ms,
                    'label_score': label_score,
                    'label_severity': _severity_from_score(label_score),
                    'error': str(exc),
                }

    def _print_per_image(self, rows, skipped):
        w = self.stdout.write
        w(self.style.SUCCESS(
            f'\n=== 이미지별 결과 ({len(rows)}장, 내용 중복 {skipped}장 제외) ===\n'
        ))
        header = (
            f"{'file':<45} {'split/class':<13} {'ok':<4} {'pred':>6} {'label':>6} "
            f"{'pred_sev':<9} {'label_sev':<9} {'match':<6}"
        )
        w(header)
        w('-' * len(header))
        for r in rows:
            tag = f"{r['split']}/{r['class']}"
            if r['ok']:
                match = 'Y' if r['severity'] == r['label_severity'] else 'N'
                w(
                    f"{r['path'].name:<45} {tag:<13} {'Y':<4} {r['redness_score']:>6.1f} "
                    f"{r['label_score']:>6.1f} {r['severity']:<9} {r['label_severity']:<9} {match:<6}"
                )
            else:
                w(f"{r['path'].name:<45} {tag:<13} {'N':<4} {'-':>6} {r['label_score']:>6.1f} "
                  f"{'-':<9} {r['label_severity']:<9} {'-':<6}  ({r['error']})")

    def _print_overall(self, rows):
        w = self.stdout.write
        ok_rows = [r for r in rows if r['ok']]
        w('\n=== 종합 ===\n')
        w(f"얼굴 인식 성공률: {len(ok_rows)}/{len(rows)} ({100 * len(ok_rows) / len(rows):.0f}%)" if rows else '이미지 없음')
        if not ok_rows:
            return

        pred = np.array([r['redness_score'] for r in ok_rows])
        label = np.array([r['label_score'] for r in ok_rows])
        errors = pred - label

        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        pearson = float(np.corrcoef(pred, label)[0, 1]) if len(pred) > 1 else float('nan')
        spearman = self._spearman(pred, label) if len(pred) > 1 else float('nan')

        w(f"MAE: {mae:.1f} / RMSE: {rmse:.1f} (0-100 스케일)")
        w(f"Pearson r: {pearson:.3f} / Spearman r: {spearman:.3f}")

        matches = sum(1 for r in ok_rows if r['severity'] == r['label_severity'])
        w(f"등급(4단계) 일치율: {matches}/{len(ok_rows)} ({100 * matches / len(ok_rows):.0f}%)")

        matrix = {actual: {pred_lbl: 0 for pred_lbl in SEVERITY_ORDER} for actual in SEVERITY_ORDER}
        for r in ok_rows:
            matrix[r['label_severity']][r['severity']] += 1
        w('\n혼동행렬 (행=라벨, 열=파이프라인 예측)')
        col_header = f"{'label \\ pred':<14}" + ''.join(f"{p:<10}" for p in SEVERITY_ORDER)
        w(col_header)
        for actual in SEVERITY_ORDER:
            row = f"{actual:<14}" + ''.join(f"{matrix[actual][p]:<10}" for p in SEVERITY_ORDER)
            w(row)

    def _print_by_class(self, rows):
        w = self.stdout.write
        w('\n=== 클래스별 세부 ===\n')
        header = f"{'split/class':<13} {'n':>4} {'성공률':>7} {'MAE':>6} {'Pearson r':>10}"
        w(header)
        w('-' * len(header))
        groups = {}
        for r in rows:
            key = (r['split'], r['class'])
            groups.setdefault(key, []).append(r)
        for (split, cls), group in sorted(groups.items()):
            ok = [r for r in group if r['ok']]
            success_rate = f"{100 * len(ok) / len(group):.0f}%"
            if len(ok) > 1:
                pred = np.array([r['redness_score'] for r in ok])
                label = np.array([r['label_score'] for r in ok])
                mae = f"{float(np.mean(np.abs(pred - label))):.1f}"
                pearson = f"{float(np.corrcoef(pred, label)[0, 1]):.3f}"
            else:
                mae = '-'
                pearson = '-'
            w(f"{split + '/' + cls:<13} {len(group):>4} {success_rate:>7} {mae:>6} {pearson:>10}")

    def _spearman(self, a, b):
        return float(np.corrcoef(self._rank(a), self._rank(b))[0, 1])

    def _rank(self, values):
        order = np.argsort(values, kind='mergesort')
        ranks = np.empty(len(values), dtype=float)
        sorted_vals = values[order]
        i = 0
        while i < len(sorted_vals):
            j = i
            while j + 1 < len(sorted_vals) and sorted_vals[j + 1] == sorted_vals[i]:
                j += 1
            avg_rank = (i + j) / 2 + 1
            ranks[order[i:j + 1]] = avg_rank
            i = j + 1
        return ranks
