import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// PWA로 홈 화면에 추가했을 때 브라우저 주소창 없이 전체화면(standalone)으로 뜨게 하는
// 설정. Expo Router의 정적 웹 export는 manifest.json을 자동으로 만들어주지 않아서
// (public/manifest.json에 직접 둠) 여기서 링크를 걸어야 하고, iOS Safari는 그 manifest의
// display 값을 아예 안 보고 이 apple-mobile-web-app-* 메타 태그만 보므로 둘 다 필요하다.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0F3D2C" />

        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari는 manifest.json의 display를 안 읽고 이 메타 태그만 본다. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="다시 봄" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
