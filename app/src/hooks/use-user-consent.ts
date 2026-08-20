import { useCallback, useEffect, useState } from 'react';

import { ApiError, getUserConsent, type UserConsent } from '@/lib/api';

export type UseUserConsentResult = {
  /** undefined = 아직 조회 전, null = 저장된 동의 기록 없음(정상 초기 상태) */
  consent: UserConsent | null | undefined;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
};

/** 얼굴 사진/건강 데이터 동의 여부를 조회하는 공용 훅 — face-capture, symptom-log 등
 * 다른 기능에서 동의 여부로 차단할 때도 이 훅을 재사용할 수 있다. */
export function useUserConsent(): UseUserConsentResult {
  const [consent, setConsent] = useState<UserConsent | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // report.tsx의 load()와 동일한 이유로 async/await 대신 .then().catch()를 쓴다 — await 이후의
  // setState도 eslint(react-hooks/set-state-in-effect)가 effect 본문 동기 호출로 오인해 flag한다.
  const refetch = useCallback(() => {
    getUserConsent()
      .then((result) => {
        setConsent(result);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err : new ApiError(0, '동의 정보를 불러오지 못했어요.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { consent, loading, error, refetch };
}
