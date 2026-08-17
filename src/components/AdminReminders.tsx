"use client";

import { useEffect } from "react";

/**
 * 오늘 뛰었는데 정산을 안 넣은 사람이 있으면 관리자에게 알립니다.
 *
 * 기사분들 알림(20시)보다 한 시간 뒤인 21시에 울립니다.
 * 먼저 본인들에게 기회를 준 다음 남은 사람만 관리자에게 알리려는 것입니다.
 *
 * 기기에 예약하는 방식이라, 관리자가 앱을 열 때의 명단으로 잡힙니다.
 * 그 사이에 누가 정산을 넣으면 명단이 어긋날 수 있으므로,
 * 정확한 현재 상태는 대시보드 카드에서 보게 해 두었습니다.
 */
const ID_UNSETTLED = 2001;
const NOTIFY_HOUR = 21;

export default function AdminReminders({ names }: { names: string[] }) {
  // 배열은 매번 새 객체라 그대로 의존성에 넣으면 계속 다시 돕니다.
  const key = names.join("|");

  useEffect(() => {
    let disposed = false;

    (async () => {
      const core = await import("@capacitor/core").catch(() => null);
      if (!core?.Capacitor?.isNativePlatform?.()) return;

      const { LocalNotifications } = await import(
        "@capacitor/local-notifications"
      ).catch(() => ({ LocalNotifications: null }) as never);
      if (!LocalNotifications || disposed) return;

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const asked = await LocalNotifications.requestPermissions();
        if (asked.display !== "granted") return;
      }

      // 예약해 둔 걸 먼저 지웁니다. 그 사이에 정산을 넣었을 수 있습니다.
      const pending = await LocalNotifications.getPending();
      const mine = pending.notifications.filter((n) => n.id === ID_UNSETTLED);
      if (mine.length > 0) {
        await LocalNotifications.cancel({ notifications: mine });
      }

      const list = key ? key.split("|") : [];
      if (list.length === 0) return;

      const at = new Date();
      at.setHours(NOTIFY_HOUR, 0, 0, 0);
      // 이미 지난 시각이면 예약하지 않습니다 (바로 울려 버립니다).
      if (at.getTime() <= Date.now() + 60_000) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: ID_UNSETTLED,
            title: `오늘 정산이 안 들어온 사람 ${list.length}명`,
            body:
              list.length <= 4
                ? `${list.join(", ")} — 운행 기록은 있는데 정산이 없습니다.`
                : `${list.slice(0, 3).join(", ")} 외 ${list.length - 3}명 — 운행 기록은 있는데 정산이 없습니다.`,
            schedule: { at },
          },
        ],
      });
    })();

    return () => {
      disposed = true;
    };
  }, [key]);

  return null;
}
