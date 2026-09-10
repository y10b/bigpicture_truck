import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayKST } from "@/lib/format";
import { Card } from "@/components/ui";
import LeavePicker, { type Leave } from "./LeavePicker";

export const metadata = { title: "월차 · BIG PICTURE" };

export default async function LeavePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = todayKST();
  // 지난 1년 + 앞으로 1년. 달을 넘겨 가며 볼 수 있는 범위입니다.
  const [{ data: leaveData }, { data: workedData }] = await Promise.all([
    supabase
      .from("leaves")
      .select("id, leave_date, memo, created_by")
      .gte("leave_date", addDays(today, -365))
      .lte("leave_date", addDays(today, 365))
      .order("leave_date", { ascending: false }),
    // 마감한 날 = 일한 날. 달력에 같이 칠해서 겹치지 않게 고르도록 돕습니다.
    supabase
      .from("v_daily_totals")
      .select("work_date")
      .eq("user_id", profile.id)
      .gte("work_date", addDays(today, -365)),
  ]);

  const leaves = (leaveData ?? []) as Leave[];
  const workedDates = ((workedData ?? []) as { work_date: string }[]).map(
    (d) => d.work_date,
  );

  return (
    <div className="space-y-4 rise">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight">월차</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          한 달에 하루 쉴 수 있습니다. 달력에서 날짜를 고르면 바로 등록됩니다.
        </p>
      </div>

      <Card className="border-brand-200 bg-brand-50/60 px-4 py-3">
        <p className="text-[13px] leading-relaxed text-ink-2">
          등록하면 <b className="text-brand-700">바로 확정</b>됩니다. 따로
          승인을 기다리지 않아도 됩니다.
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-4">
          날짜를 바꾸고 싶으면 잡아 둔 날을 다시 눌러 취소한 뒤 고르면 됩니다.
        </p>
      </Card>

      <LeavePicker
        userId={profile.id}
        leaves={leaves}
        workedDates={workedDates}
      />
    </div>
  );
}
