import { useEffect, useState } from 'react';

import { getConsent } from '@/lib/api';

/** 얼굴 분석 진입을 막을지 판단하는 용도. health_data_consent는 차단에 안 쓰여 노출하지 않는다
 * (Google Health 외부 연동용 동의라 이 훅이 다루는 범위 밖). */
export function useConsent() {
  const [faceAnalysisConsent, setFaceAnalysisConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getConsent()
      .then((consent) => {
        if (!cancelled) setFaceAnalysisConsent(consent.face_analysis_consent);
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
