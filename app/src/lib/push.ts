import { Platform } from 'react-native';

import { getVapidPublicKey, subscribePush, unsubscribePush } from '@/lib/api';

const SERVICE_WORKER_URL = '/sw.js';

/** Web Push는 브라우저 표준 API(Notification/PushManager/serviceWorker)라 네이티브
 * iOS/Android에는 대응 개념이 없다 — Platform.OS로 먼저 걸러야 네이티브에서
 * `navigator`/`Notification` 참조 자체가 나지 않는다. */
export function isPushSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** 지원하지 않는 환경(네이티브, 구형 브라우저)에서는 null. */
export function getNotificationPermission(): NotificationPermission | null {
  if (!isPushSupported()) return null;
  return Notification.permission;
}

/** VAPID 공개키(base64url)를 PushManager.subscribe가 요구하는 Uint8Array로 변환한다. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** 이미 등록된 서비스워커가 있으면 그 등록의 구독을, 없으면 null을 반환한다.
 * 브라우저는 한 번 register()된 서비스워커를 새로고침 후에도 기억하므로, 상태 확인용으로는
 * 재등록 없이 조회만 하면 된다. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** 알림 권한을 요청하고, 승인되면 서비스워커를 등록해 Push Subscription을 만든 뒤
 * `/api/push/subscribe/`에 등록한다. 리마인더 발송 시각은 Railway Cron이 서버에서 판단하므로
 * 여기서는 구독을 만들어 서버에 넘기는 것까지만 담당한다. */
export async function enablePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('이 브라우저에서는 알림을 지원하지 않아요.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 허용되지 않았어요.');
  }

  await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  const registration = await navigator.serviceWorker.ready;

  const { publicKey } = await getVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    // TS 6 dom 타입에서 Uint8Array가 ArrayBufferLike로 제네릭화되며 BufferSource와 어긋나 생기는
    // 타입 불일치 — 런타임 값 자체는 스펙대로의 BufferSource라 안전하게 캐스팅한다.
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('구독 정보를 만드는 데 실패했어요.');
  }

  await subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

/** 서버 등록을 먼저 해제한 뒤 브라우저 구독을 해제한다 — 순서를 반대로 하면 서버 호출이
 * 실패했을 때 브라우저만 구독 해제된 채로 서버 레코드가 남아 다음 상태 확인이 꼬인다.
 * 이 브라우저의 구독만 지운다 — 같은 계정의 다른 기기 구독은 건드리지 않는다(서버가
 * endpoint 단위로만 삭제하므로 자연히 보장됨). */
export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  await unsubscribePush(subscription.endpoint);
  await subscription.unsubscribe();
}
