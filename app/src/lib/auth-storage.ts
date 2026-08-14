import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'dasibom_access_token';
const REFRESH_KEY = 'dasibom_refresh_token';

export type AuthTokens = {
  access: string;
  refresh: string;
};

// 네이티브는 SecureStore(암호화 저장), 웹은 별도 패키지 없이 localStorage를 사용 — 둘 다
// 앱 재실행/새로고침 후에도 유지된다.
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getTokens(): Promise<AuthTokens | null> {
  const [access, refresh] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
  if (!access || !refresh) {
    return null;
  }
  return { access, refresh };
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([setItem(ACCESS_KEY, tokens.access), setItem(REFRESH_KEY, tokens.refresh)]);
}

export async function saveAccessToken(access: string): Promise<void> {
  await setItem(ACCESS_KEY, access);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}
