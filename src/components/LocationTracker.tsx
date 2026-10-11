"use client";

import { useEffect } from "react";
import { saveLocation } from "@/app/(app)/location-actions";
import { shouldTrackNow } from "@/lib/tracking";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/** 이 거리(m) 이상 움직였을 때만 새 위치를 받습니다. */
const DISTANCE_FILTER = 150;

/** 아무리 자주 움직여도 이 간격보다 자주 보내지는 않습니다. */
const MIN_SEND_GAP_MS = 60_000;

/**
 * 지금 켜야 하는지 다시 따져 보는 간격.
 *
 * 앱을 며칠씩 열어 두는 분이 있어서, 켤 때 한 번만 판단하면 안 됩니다.
 * 밤에 꺼 뒀다가 아침 8시가 되어도 감시가 안 걸리는 일이 생깁니다.
 */
const RECHECK_MS = 5 * 60_000;

/**
 * 기사 위치를 관리자가 볼 수 있게 보내는 부분. 앱에서만 동작합니다.
 *
 * 배터리를 아끼려고 잡은 것들:
 *  - 시간이 아니라 **거리**로 받습니다. 신호 대기·상하차 중엔 아예 안 씁니다
 *  - 인성·카카오T 같은 앱이 이미 위치를 받고 있으면 안드로이드가 그 결과를
 *    같이 넘겨주므로 추가 소모가 거의 없습니다
 *  - 보낼 필요가 없는 시간대에는 감시 자체를 걷어 냅니다 (알림도 같이 사라집니다)
 *
 * 근무시간(08~22시) 밖에는 보내지 않습니다. 감시가 아니라 업무용이라는 걸
 * 분명히 하려는 것이고, 서버에서도 한 번 더 막습니다.
 *
 * 오후 5시까지는 공유를 꺼 두셨어도 보냅니다 — 배송 중에 사고가 나면
 * 어디 계신지 바로 알아야 해서입니다. 그 뒤로는 켜 두신 경우에만 보냅니다.
 */
export default function LocationTracker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    let plugin: BackgroundGeolocationPlugin | null = null;
    let watcherId: string | null = null;
    let lastSentAt = 0;
    let disposed = false;
    /** start/stop 이 겹쳐 돌아 감시가 두 개 생기는 걸 막습니다 */
    let busy = false;

    async function getPlugin() {
      if (plugin) return plugin;
      const core = await import("@capacitor/core").catch(() => null);
      if (!core?.Capacitor?.isNativePlatform?.()) return null;
      // 이 플러그인은 JS 파일을 담고 있지 않습니다. 네이티브 쪽만 있고
      // JS 연결은 registerPlugin 으로 직접 만들어야 합니다.
      plugin = core.registerPlugin<BackgroundGeolocationPlugin>(
        "BackgroundGeolocation",
      );
      return plugin;
    }

    async function start() {
      const p = await getPlugin();
      if (!p || disposed || watcherId) return;

      watcherId = await p.addWatcher(
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

          // 감시를 걷어 내기 전에 들어온 위치가 있을 수 있어 여기서도 봅니다.
          if (!shouldTrackNow(enabled)) return;

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
    }

    async function stop() {
      if (!plugin || !watcherId) return;
      const id = watcherId;
      watcherId = null;
      await plugin.removeWatcher({ id }).catch(() => {});
    }

    /** 지금 켜야 하면 켜고, 아니면 끕니다. */
    async function sync() {
      if (disposed || busy) return;
      busy = true;
      try {
        if (shouldTrackNow(enabled)) await start();
        else await stop();
      } finally {
        busy = false;
      }
    }

    void sync();
    const timer = setInterval(() => void sync(), RECHECK_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      void stop();
    };
  }, [enabled]);

  return null;
}
