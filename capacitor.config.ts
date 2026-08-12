import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 앱은 화면을 들고 있지 않습니다. 서버(Vercel)에 올라간 화면을 그대로 띄웁니다.
 *
 * 그래서 배포만 하면 기사분들이 다음에 열 때 자동으로 새 버전이 됩니다.
 * 앱을 다시 깔거나 스토어 심사를 기다릴 필요가 없습니다.
 *
 * 이 껍데기 자체를 새로 빌드해야 하는 경우는 다음뿐입니다.
 *  - 앱 이름 / 아이콘 / 스플래시 변경
 *  - 카메라·위치 같은 네이티브 기능 추가
 */
const config: CapacitorConfig = {
  appId: "kr.bigpicture.settlement",
  appName: "BIG PICTURE",
  // server.url 을 쓰므로 로컬 자산은 안내 페이지 하나만 들어갑니다.
  webDir: "native-shell",

  server: {
    url: process.env.CAP_SERVER_URL ?? "https://bigpicture-truck.vercel.app",
    // 앱 안에서 서버 화면을 띄우므로 https 로 고정합니다.
    androidScheme: "https",
    // 다른 사이트로 새는 걸 막습니다. 그 외 링크는 기본 브라우저로 열립니다.
    allowNavigation: ["bigpicture-truck.vercel.app"],
  },

  android: {
    // 흰 화면이 번쩍이지 않도록 배경을 로고 종이색으로
    backgroundColor: "#f5f3ec",
  },

  ios: {
    backgroundColor: "#f5f3ec",
    // 하단 홈바 영역까지 화면이 차도록 (웹 쪽에서 safe-area 로 여백을 줍니다)
    contentInset: "never",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#14161a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
