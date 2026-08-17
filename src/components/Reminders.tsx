"use client";

import { useEffect } from "react";

/**
 * 정산·출금을 잊지 않게 알림을 예약합니다. 앱에서만 동작합니다.
 *
 * 서버에서 밀어주는 푸시(FCM)가 아니라 **기기에 예약해 두는 알림**입니다.
 * 파이어베이스 설정도, 서버에서 돌릴 작업도 필요 없고 비용도 안 듭니다.
 *
 * 대신 규칙이 하나 있습니다 — 앱을 열 때마다 오늘 상태를 보고 다시 잡습니다.
 * 이미 마감했으면 오늘 알림을 지우고, 아직이면 저녁에 울리게 예약합니다.
 * 기사분들이 매일 앱을 열어 정산을 넣으니 이 방식으로 충분합니다.
 */
const ID_SETTLEMENT = 1001;
const ID_WITHDRAWAL = 1002;

export default function Reminders({
  settledToday,
  needsWithdrawal,
}: {
  /** 오늘 마감을 이미 했는지 */
  settledToday: boolean;
  /** 이번 주 마지막 근무일인데 출금 기록이 없는지 */
  needsWithdrawal: boolean;
}) {
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

      // 예약해 둔 걸 먼저 지웁니다. 상태가 바뀌었을 수 있습니다.
      const pending = await LocalNotifications.getPending();
      const mine = pending.notifications.filter((n) =>
        [ID_SETTLEMENT, ID_WITHDRAWAL].includes(n.id),
      );
      if (mine.length > 0) {
        await LocalNotifications.cancel({ notifications: mine });
      }

      const schedule: Parameters<
        typeof LocalNotifications.schedule
      >[0]["notifications"] = [];

      // 오늘 저녁 8시 — 이미 지났으면 예약하지 않습니다
      const at = (hour: number) => {
        const d = new Date();
        d.setHours(hour, 0, 0, 0);
        return d.getTime() > Date.now() + 60_000 ? d : null;
      };

      if (!settledToday) {
        const when = at(20);
        if (when) {
          schedule.push({
            id: ID_SETTLEMENT,
            title: "오늘 정산 입력하셨나요?",
            body: "정산입력 화면에서 하루 마감을 저장해 주세요.",
            schedule: { at: when },
          });
        }
      }

      if (needsWithdrawal) {
        const when = at(19);
        if (when) {
          schedule.push({
            id: ID_WITHDRAWAL,
            title: "이번 주 출금 기록이 없습니다",
            body: "출금하셨으면 일주일 출금 탭에 금액을 남겨 주세요.",
            schedule: { at: when },
          });
        }
      }

      if (schedule.length > 0) {
        await LocalNotifications.schedule({ notifications: schedule });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [settledToday, needsWithdrawal]);

  return null;
}
