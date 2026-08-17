import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Unsettled = {
  user_id: string;
  name: string;
  /** 오늘 주행거리(m) */
  meters: number;
};

/**
 * 오늘 뛰었는데 정산을 안 넣은 사람.
 *
 * "일했는지" 는 주행거리로 봅니다. 근무를 시작하면 앱을 켜므로 위치가 쌓이고,
 * 3km 넘게 움직였는데 정산 기록이 하나도 없으면 아직 안 넣은 것으로 봅니다.
 *
 * 관리자 화면 여러 곳에서 쓰므로 한 요청 안에서는 한 번만 조회합니다.
 */
export const getUnsettledToday = cache(async (): Promise<Unsettled[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("unsettled_today");
  return (data ?? []) as Unsettled[];
});
