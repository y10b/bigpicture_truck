"use client";

import { useEffect } from "react";
import { registerPushToken } from "@/app/(app)/push-actions";

/**
 * 앱에서 푸시 알림을 켭니다. 웹에서는 아무 일도 하지 않습니다.
 *
 * 기기 토큰을 받아 서버에 올려 두면, 서버가 그 사람에게 알림을 보낼 수 있습니다.
 * 토큰은 재설치·데이터 삭제 때 바뀌므로 앱을 열 때마다 확인합니다.
 */
export default function PushSetup() {
  useEffect(() => {
    let disposed = false;

    (async () => {
      const core = await import("@capacitor/core").catch(() => null);
      if (!core?.Capacitor?.isNativePlatform?.()) return;

      const mod = await import("@capacitor/push-notifications").catch(
        () => null,
      );
      const PushNotifications = mod?.PushNotifications;
      if (!PushNotifications || disposed) return;

      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== "granted") {
        const asked = await PushNotifications.requestPermissions();
        if (asked.receive !== "granted") return;
      }
      if (disposed) return;

      // 리스너를 먼저 달고 등록해야 토큰을 놓치지 않습니다.
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener("registration", (t) => {
        void registerPushToken(t.value);
      });

      await PushNotifications.addListener("registrationError", () => {
        // 파이어베이스 설정이 안 된 앱에서는 여기로 옵니다. 조용히 넘어갑니다.
      });

      // 알림을 눌러서 앱이 열렸을 때 해당 화면으로 보냅니다.
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const link = action.notification?.data?.link;
          if (typeof link === "string" && link.startsWith("/")) {
            window.location.assign(link);
          }
        },
      );

      await PushNotifications.register();
    })();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
