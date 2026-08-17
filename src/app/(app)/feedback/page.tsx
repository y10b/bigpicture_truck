import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayKST } from "@/lib/format";
import type { Feedback } from "../feedback-actions";
import { Card, Empty } from "@/components/ui";
import FeedbackList from "./FeedbackList";

export const metadata = { title: "마감 피드백 · BIG PICTURE" };

export default async function FeedbackPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("ai_reports")
    .select("report_date, content, created_at")
    .eq("user_id", profile.id)
    .eq("kind", "daily")
    .order("report_date", { ascending: false })
    .limit(60);

  const rows = ((data ?? []) as {
    report_date: string;
    content: Feedback;
    created_at: string;
  }[]).filter((r) => r.content?.headline);

  const today = todayKST();
  const hasToday = rows.some((r) => r.report_date === today);

  return (
    <div className="space-y-4 rise">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight">마감 피드백</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          하루 마감을 저장하면 그날 운행을 되짚어 정리해 드립니다. 여기에
          날짜별로 쌓입니다.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon="📝"
            title="아직 쌓인 피드백이 없습니다"
            desc="정산입력 화면에서 하루 마감을 저장하면 여기에 생깁니다."
          />
        </Card>
      ) : (
        <FeedbackList
          rows={rows}
          today={today}
          hasToday={hasToday}
          yesterday={addDays(today, -1)}
        />
      )}
    </div>
  );
}
