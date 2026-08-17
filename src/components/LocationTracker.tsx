"use client";

import { useEffect } from "react";
import { saveLocation } from "@/app/(app)/location-actions";
import { TRACK_FROM_HOUR, TRACK_TO_HOUR } from "@/lib/tracking";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** 이 거리(m) 이상 움직였을 때만 새 위치를 받습니다. */
const DISTANCE_FILTER = 150;

/** 아무리 자주 움직여도 이 간격보다 자주 보내지는 않습니다. */
const MIN_SEND_GAP_MS = 60_000;

function seoulHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

/**
 * 기사 위치를 관리자가 볼 수 있게 보내는 부분. 앱에서만 동작합니다.
 *
 * 배터리를 아끼려고 잡은 것들:
 *  - 시간이 아니라 **거리**로 받습니다. 신호 대기·상하차 중엔 아예 안 씁니다
 *  - 인성·카카오T 같은 앱이 이미 위치를 받고 있으면 안드로이드가 그 결과를
 *    같이 넘겨주므로 추가 소모가 거의 없습니다
 *  - 밤에는 차가 서 있어 위치가 안 바뀌니 자연히 조용해집니다
 *
 * 근무시간(08~22시) 밖에는 보내지 않습니다. 감시가 아니라 업무용이라는 걸
 * 분명히 하려는 것이고, 서버에서도 한 번 더 막습니다.
 */
export default function LocationTracker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    let watcherId: string | null = null;
    let plugin: BackgroundGeolocationPlugin | null = null;
    let lastSentAt = 0;
    let disposed = false;

    (async () => {
      const core = await import("@capacitor/core").catch(() => null);
      if (!core?.Capacitor?.isNativePlatform?.()) return;
      if (disposed) return;

      // 이 플러그인은 JS 파일을 담고 있지 않습니다. 네이티브 쪽만 있고
      // JS 연결은 registerPlugin 으로 직접 만들어야 합니다.
      plugin = core.registerPlugin<BackgroundGeolocationPlugin>(
        "BackgroundGeolocation",
      );

      watcherId = await plugin.addWatcher(
        {
          // 안드로이드는 배경에서 위치를 받으려면 알림을 반드시 띄워야 합니다.
          // 감추는 방법이 없고, 감추는 게 옳지도 않습니다.
          backgroundMessage: "근무 중 위치를 회사에 공유하고 있습니다",
          backgroundTitle: "BIG PICTURE",
          requestPermissions: true,
          stale: false,
          distanceFilter: DISTANCE_FILTER,
        },
        (location, error) => {
          if (error || !location) return;

          // 근무시간이 아니면 받은 위치를 그냥 버립니다.
          const hour = seoulHour();
          if (hour < TRACK_FROM_HOUR || hour >= TRACK_TO_HOUR) return;

          const now = Date.now();
          if (now - lastSentAt < MIN_SEND_GAP_MS) return;
          lastSentAt = now;

          void saveLocation({
            lat: location.latitude,
            lng: location.longitude,
            accuracy: location.accuracy ?? null,
            speed: location.speed ?? null,
            heading: location.bearing ?? null,
            recordedAt: location.time
              ? new Date(location.time).toISOString()
              : undefined,
          }).catch(() => {
            // 통신이 잠깐 끊긴 것뿐이니 다음 위치에서 다시 보냅니다.
            lastSentAt = 0;
          });
        },
      );
    })();

    return () => {
      disposed = true;
      if (plugin && watcherId) {
        void plugin.removeWatcher({ id: watcherId }).catch(() => {});
      }
    };
  }, [enabled]);

  return null;
}
