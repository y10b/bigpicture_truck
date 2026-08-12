"use client";

import { useEffect } from "react";

/**
 * 앱(Capacitor 껍데기)으로 열렸을 때만 동작하는 연결부.
 * 브라우저로 열면 아무 일도 하지 않습니다.
 *
 * - 안드로이드 뒤로가기 버튼: 앱이 바로 꺼지지 않고 이전 화면으로
 * - 상단 상태바 색을 헤더(잉크색)에 맞춤
 * - 화면이 준비되면 스플래시를 내림
 */
export default function NativeBridge() {
  useEffect(() => {
    let disposed = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      // 앱이 아니면 여기서 조용히 끝냅니다.
      const core = await import("@capacitor/core").catch(() => null);
      if (!core?.Capacitor?.isNativePlatform?.()) return;
      if (disposed) return;

      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);

      // 헤더가 어두운 색이라 상태바 글자는 밝게
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: "#14161a" }).catch(() => {});

      const handle = await App.addListener("backButton", ({ canGoBack }) => {
        // 첫 화면에서 뒤로가기를 누르면 앱을 닫고, 아니면 이전 화면으로
        if (canGoBack) window.history.back();
        else App.exitApp();
      });
      cleanups.push(() => void handle.remove());

      await SplashScreen.hide().catch(() => {});
    })();

    return () => {
      disposed = true;
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
