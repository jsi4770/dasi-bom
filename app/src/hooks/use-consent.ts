import { useEffect, useState } from 'react';

import { getUserConsent } from '@/lib/api';

/** 얼굴 분석 진입을 막을지 판단하는 용도. health_data_consent는 차단에 안 쓰여 노출하지 않는다
 * (Google Health 외부 연동용 동의라 이 훅이 다루는 범위 밖). */
export function useConsent() {
  const [faceAnalysisConsent, setFaceAnalysisConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getUserConsent()
      .then((consent) => {
        // null = 저장된 동의 기록 없음(정상 초기 상태) — 미동의로 취급
        if (!cancelled) setFaceAnalysisConsent(consent?.face_analysis_consent ?? false);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { faceAnalysisConsent, loading };
}
