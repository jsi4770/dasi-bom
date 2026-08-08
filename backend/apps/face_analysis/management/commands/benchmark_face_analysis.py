import hashlib
import json
import time
import unicodedata
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.face_analysis.analysis import NoFaceDetectedError, analyze_face_redness

DEFAULT_DIR = settings.MEDIA_ROOT / 'face_analysis' / '2026' / '08' / '07'
DEFAULT_LABELS = Path(settings.BASE_DIR) / 'apps' / 'face_analysis' / 'benchmark_labels.json'
IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg'}
SEVERITY_ORDER = ('normal', 'mild', 'moderate', 'severe')


class Command(BaseCommand):
    help = (
        'Run analyze_face_redness() over a folder of test photos and print a '
        'processing-result report (scores, excluded regions, timing). '
        'De-dupes re-uploads of the same source image by content hash. '
        'If a labels JSON file (filename -> hand-labeled severity) is found, '
        'also prints agreement rate and a confusion matrix.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dir', default=str(DEFAULT_DIR), help='Folder of test photos')
        parser.add_argument('--labels', default=str(DEFAULT_LABELS), help='JSON file of filename -> severity label')

    def handle(self, *args, **options):
        folder = Path(options['dir'])
        if not folder.is_dir():
            self.stderr.write(self.style.ERROR(f'No such folder: {folder}'))
            return

        labels = self._load_labels(Path(options['labels']))

        files = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        unique_files = self._dedupe(files)
        skipped = len(files) - len(unique_files)

        rows = []
        for path in unique_files:
            row = self._run_one(path)
            row['label'] = labels.get(unicodedata.normalize('NFC', path.name))
            rows.append(row)

        self._print_report(rows, skipped)
        if labels:
            self._print_agreement(rows)

    def _load_labels(self, path):
        if not path.is_file():
            return {}
        data = json.loads(path.read_text())
        return {
            unicodedata.normalize('NFC', k): v
            for k, v in data.items()
            if not k.startswith('_')
        }

    def _dedupe(self, files):
        seen = {}
        for path in files:
            digest = hashlib.md5(path.read_bytes()).hexdigest()
            seen.setdefault(digest, path)
        return list(seen.values())

    def _run_one(self, path):
        with path.open('rb') as image_file:
            start = time.perf_counter()
            try:
                result = analyze_face_redness(image_file)
                elapsed_ms = (time.perf_counter() - start) * 1000
                return {'file': path.name, 'ok': True, 'elapsed_ms': elapsed_ms, **result}
            except NoFaceDetectedError as exc:
                elapsed_ms = (time.perf_counter() - start) * 1000
                return {'file': path.name, 'ok': False, 'elapsed_ms': elapsed_ms, 'error': str(exc)}

    def _print_report(self, rows, skipped):
        w = self.stdout.write
        w(self.style.SUCCESS(f'\n=== face_analysis 처리 결과 리포트 ({len(rows)}장, 중복 재업로드 {skipped}장 제외) ===\n'))

        header = (
            f"{'file':<45} {'ok':<4} {'score':>6} {'severity':<9} {'label':<9} "
            f"{'excluded':<28} {'lit.corr':<8} {'ms':>7}"
        )
        w(header)
        w('-' * len(header))

        for r in rows:
            label = r['label'] or '-'
            if r['ok']:
                w(
                    f"{r['file']:<45} {'Y':<4} {r['redness_score']:>6.1f} "
                    f"{r['severity']:<9} {label:<9} {','.join(r['excluded_regions']) or '-':<28} "
                    f"{str(r['lighting_corrected']):<8} {r['elapsed_ms']:>7.0f}"
                )
            else:
                w(f"{r['file']:<45} {'N':<4} {'-':>6} {'-':<9} {label:<9} {r['error']:<28} {'-':<8} {r['elapsed_ms']:>7.0f}")

        ok_rows = [r for r in rows if r['ok']]
        w('')
        w(f"얼굴 인식 성공률: {len(ok_rows)}/{len(rows)} ({100 * len(ok_rows) / len(rows):.0f}%)" if rows else '사진 없음')
        if ok_rows:
            avg_score = sum(r['redness_score'] for r in ok_rows) / len(ok_rows)
            avg_ms = sum(r['elapsed_ms'] for r in ok_rows) / len(ok_rows)
            severity_counts = {}
            excluded_counts = {}
            for r in ok_rows:
                severity_counts[r['severity']] = severity_counts.get(r['severity'], 0) + 1
                for region in r['excluded_regions']:
                    excluded_counts[region] = excluded_counts.get(region, 0) + 1

            w(f"평균 redness_score: {avg_score:.1f}")
            w(f"평균 처리 시간: {avg_ms:.0f}ms")
            w(f"severity 분포: {severity_counts}")
            w(f"영역별 제외 횟수: {excluded_counts or '없음'}")
            lit_corrected = sum(1 for r in ok_rows if r['lighting_corrected'])
            w(f"조명 보정 적용률: {lit_corrected}/{len(ok_rows)}")

    def _print_agreement(self, rows):
        w = self.stdout.write
        labeled = [r for r in rows if r['ok'] and r['label']]
        w(f"\n=== 라벨 대비 일치율 ({len(labeled)}장에 라벨 있음) ===\n")

        if not labeled:
            w('라벨이 매칭된 사진이 없습니다.')
            return

        matches = sum(1 for r in labeled if r['severity'] == r['label'])
        w(f"일치율: {matches}/{len(labeled)} ({100 * matches / len(labeled):.0f}%)")

        matrix = {actual: {pred: 0 for pred in SEVERITY_ORDER} for actual in SEVERITY_ORDER}
        for r in labeled:
            if r['label'] in matrix and r['severity'] in matrix[r['label']]:
                matrix[r['label']][r['severity']] += 1

        w('\n혼동행렬 (행=라벨, 열=파이프라인 예측)')
        col_header = f"{'label \\ pred':<14}" + ''.join(f"{p:<10}" for p in SEVERITY_ORDER)
        w(col_header)
        for actual in SEVERITY_ORDER:
            row = f"{actual:<14}" + ''.join(f"{matrix[actual][pred]:<10}" for pred in SEVERITY_ORDER)
            w(row)

        w('\n불일치 상세:')
        for r in labeled:
            if r['severity'] != r['label']:
                w(f"  {r['file']}: 라벨={r['label']} vs 예측={r['severity']} (score={r['redness_score']:.1f})")
