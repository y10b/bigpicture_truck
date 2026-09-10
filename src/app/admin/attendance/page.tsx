import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { endOfMonth, startOfMonth, todayKST } from "@/lib/format";
import type { Profile } from "@/lib/types";
import AttendanceView, {
  type AttendanceRow,
  type LeaveRow,
  type WorkedRow,
} from "./AttendanceView";

export const metadata = { title: "출근 · 월차 · BIG PICTURE" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requireAdmin();
  const { month: rawMonth } = await searchParams;

  const today = todayKST();
  // 이상한 값이 들어와도 이번 달로 떨어지게 합니다.
  const month = /^\d{4}-\d{2}$/.test(rawMonth ?? "")
    ? rawMonth!
    : today.slice(0, 7);
  const from = `${month}-01`;
  const to = endOfMonth(from);

  const supabase = await createClient();
  // 한 달 × 11명이면 최대 341행이라 1000행 제한에 걸리지 않습니다.
  const [
    { data: profileData },
    { data: workedData },
    { data: attendanceData },
    { data: leaveData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true }),
    // 마감한 날 = 출근 확정
    supabase
      .from("v_daily_totals")
      .select("user_id, work_date, count, total")
      .gte("work_date", from)
      .lte("work_date", to),
    // 앱을 켠 기록 = 나왔다는 신호
    supabase
      .from("attendance")
      .select("user_id, work_date, first_open_at")
      .gte("work_date", from)
      .lte("work_date", to),
    supabase
      .from("leaves")
      .select("id, user_id, leave_date, memo")
      .gte("leave_date", from)
      .lte("leave_date", to),
  ]);

  // 올해 월차 사용 현황도 같이 봅니다 (직원별 목록에 씁니다)
  const { data: yearLeaveData } = await supabase
    .from("leaves")
    .select("user_id, leave_date")
    .gte("leave_date", `${month.slice(0, 4)}-01-01`)
    .lte("leave_date", `${month.slice(0, 4)}-12-31`);

  return (
    <AttendanceView
      month={month}
      today={today}
      meId={me.id}
      profiles={(profileData ?? []) as Profile[]}
      worked={(workedData ?? []) as WorkedRow[]}
      attendance={(attendanceData ?? []) as AttendanceRow[]}
      leaves={(leaveData ?? []) as LeaveRow[]}
      yearLeaves={(yearLeaveData ?? []) as { user_id: string; leave_date: string }[]}
    />
  );
}
