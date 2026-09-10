"use client";

import { useEffect } from "react";
import { checkIn } from "@/app/(app)/attendance-actions";

/**
 * 앱(또는 웹)을 열면 출근을 남깁니다.
 *
 * 관리자는 이걸로 "누가 나왔는지" 를 아침에 바로 봅니다.
 * 화면에는 아무것도 그리지 않습니다 — 기사분들이 따로 누를 게 없어야
 * 빠뜨리는 사람이 안 생깁니다.
 *
 * 하루에 한 번만 보내면 충분하므로, 오늘 이미 보냈으면 건너뜁니다.
 * (앱이 화면을 다시 그릴 때마다 요청이 나가는 걸 막습니다)
 */
const KEY = "bp:checked-in";

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

export default function CheckIn() {
  useEffect(() => {
    const today = todayKST();
    try {
      if (localStorage.getItem(KEY) === today) return;
    } catch {
      // 저장소를 막아 둔 브라우저면 그냥 매번 보냅니다. 서버가 알아서 합칩니다.
    }

    void checkIn().finally(() => {
      try {
        localStorage.setItem(KEY, today);
      } catch {
        /* 저장 못 해도 동작에는 지장 없습니다 */
      }
    });
  }, []);

  return null;
}
