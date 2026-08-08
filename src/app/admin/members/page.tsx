import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startOfMonth, todayKST } from "@/lib/format";
import { DEFAULT_WEEKDAY_LEVY, settleFromUserTotals } from "@/lib/settlement";
import type { Profile, UserTotals } from "@/lib/types";
import { Card, Empty } from "@/components/ui";
import LevySettings from "./LevySettings";
import MemberCard from "./MemberCard";
import MemberCreateForm from "./MemberCreateForm";

export const metadata = { title: "직원 관리 · BIG PICTURE" };

export default async function MembersPage() {
  const me = await requireAdmin();
  const today = todayKST();

  const supabase = await createClient();
  const [{ data: profileData }, { data: totalsData }, { data: settings }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      // 이번 달 실적은 DB에서 직원별로 합쳐 받습니다 (1000행 제한 회피)
      supabase.rpc("admin_totals_by_user", {
        from_date: startOfMonth(today),
        to_date: today,
      }),
      supabase.from("app_settings").select("weekday_levy").eq("id", 1).maybeSingle(),
    ]);

  const profiles = (profileData ?? []) as Profile[];
  const levyRate = settings?.weekday_levy ?? DEFAULT_WEEKDAY_LEVY;

  const stats = new Map(
    ((totalsData ?? []) as UserTotals[]).map((r) => [
      r.user_id,
      settleFromUserTotals(r, levyRate),
    ]),
  );

  return (
    <div className="space-y-4 rise">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[20px] font-extrabold tracking-tight">직원 관리</h1>
        <span className="text-[13px] font-semibold text-ink-4">
          총 <span className="tnum">{profiles.length}</span>명
        </span>
      </div>

      <LevySettings current={levyRate} />

      <MemberCreateForm />

      {profiles.length === 0 ? (
        <Card>
          <Empty icon="👷" title="등록된 직원이 없습니다" desc="위 버튼으로 계정을 만들어 주세요." />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {profiles.map((p) => (
            <li key={p.id}>
              <MemberCard
                profile={p}
                stat={stats.get(p.id)}
                isMe={p.id === me.id}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 pt-1 text-[12px] leading-relaxed text-ink-4">
        직원은 <b>휴대폰번호</b>와 비밀번호로 로그인합니다. 비밀번호를 잊으면 여기서
        새로 정해 주세요.
      </p>
    </div>
  );
}
