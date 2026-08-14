import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  demoLogin as demoLoginRequest,
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  setSessionExpiredHandler,
  signup as signupRequest,
  type AuthUser,
  type SignupPayload,
} from '@/lib/api';
import { getTokens } from '@/lib/auth-storage';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // refresh까지 실패해 세션이 끊기면 api.ts가 이 핸들러를 호출한다 — 토큰 삭제는 api.ts 쪽에서 이미 처리됨.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // 부팅 시 저장된 토큰이 있으면 /api/users/me/로 유효성을 확인(만료됐으면 요청 내부에서 자동 refresh)한다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await getTokens();
      if (!tokens) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await loginRequest(username, password);
    const me = await getMe();
    setUser(me);
    setStatus('authenticated');
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const session = await signupRequest(payload);
    setUser({ id: session.id, username: session.username, email: session.email });
    setStatus('authenticated');
  }, []);

  const demoLogin = useCallback(async () => {
    const session = await demoLoginRequest();
    setUser({ id: session.id, username: session.username, email: session.email });
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ status, user, login, signup, demoLogin, logout }),
    [status, user, login, signup, demoLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있어요.');
  }
  return ctx;
}
