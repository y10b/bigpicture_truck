import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/login/actions";
import { prettyPhone, startOfMonth, todayKST, won } from "@/lib/format";
import Link from "next/link";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import LocationToggle from "./LocationToggle";
import PasswordForm from "./PasswordForm";

export const metadata = { title: "내 정보 · BIG PICTURE" };

export default async function MePage() {
  const profile = await requireProfile();
  const today = todayKST();

  const supabase = await createClient();
  // 날짜별로 합쳐진 뷰라 한 달이어도 최대 31행입니다.
  const { data } = await supabase
    .from("v_daily_totals")
    .select("count, total")
    .eq("user_id", profile.id)
    .gte("work_date", startOfMonth(today))
    .lte("work_date", today);

  // 읽을 권한이 있는 사람에게만 0 이 아닌 값이 옵니다 (함수 안에서 검사).
  const { data: unreadVoice } = await supabase.rpc("voice_unread_count");

  const rows = data ?? [];
  const monthCount = rows.reduce((a, r) => a + (r.count ?? 0), 0);
  const monthTotal = rows.reduce((a, r) => a + (r.total ?? 0), 0);

  return (
    <div className="space-y-4 rise">
      <h1 className="text-[20px] font-extrabold tracking-tight">내 정보</h1>

      <Card className="p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-[18px] font-extrabold text-white">
            {profile.name.slice(-2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[17px] font-extrabold">{profile.name}</p>
              {profile.role === "admin" && <Badge tone="brand">관리자</Badge>}
            </div>
            <p className="tnum mt-0.5 text-[13px] text-ink-3">
              {prettyPhone(profile.phone)}
            </p>
          </div>
        </div>

        {(profile.vehicle_no || profile.vehicle_type || profile.bank_account) && (
          <dl className="mt-4 space-y-2 border-t border-ink/8 pt-4">
            {(profile.vehicle_no || profile.vehicle_type) && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[12px] font-semibold text-ink-4">차량</dt>
                <dd className="text-[13px] font-semibold">
                  {[profile.vehicle_no, profile.vehicle_type]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {profile.bank_account && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-[12px] font-semibold text-ink-4">계좌</dt>
                <dd className="tnum truncate text-[13px] font-semibold">
                  {profile.bank_account}
                </dd>
              </div>
            )}
            <p className="pt-0.5 text-[11px] text-ink-4">
              틀린 곳이 있으면 관리자에게 말씀해 주세요.
            </p>
          </dl>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/8 pt-4">
          <div>
            <p className="text-[12px] font-semibold text-ink-4">이번 달 건수</p>
            <p className="tnum mt-0.5 text-[17px] font-extrabold">{monthCount}건</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink-4">이번 달 정산</p>
            <p className="tnum mt-0.5 text-[17px] font-extrabold">
              {won(monthTotal)}원
            </p>
          </div>
        </div>
      </Card>

      {/* 고충을 말할 데가 있어야 합니다. 눈에 띄되, 내 정보 안에 둬서 남 앞에서 열 일이 없게 했습니다 */}
      <Link href="/voice">
        <Card className="flex items-center gap-3 border-brand-200 bg-brand-50 px-4 py-3.5 transition-colors active:bg-brand-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-[17px]">
            🕊️
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[14px] font-extrabold text-brand-700">
              사장님께
              {Boolean(unreadVoice) && (
                <span className="tnum rounded-full bg-danger px-1.5 py-0.5 text-[10px] leading-none font-bold text-white">
                  새 {unreadVoice}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed font-semibold text-brand-600/80">
              {profile.can_read_voice
                ? "들어온 이야기를 보고 답장할 수 있습니다"
                : "힘든 점을 이름 없이 전할 수 있습니다"}
            </p>
          </div>
          <span aria-hidden className="shrink-0 text-ink-4">
            ›
          </span>
        </Card>
      </Link>

      <LocationToggle on={profile.share_location} />

      <Card>
        <CardHeader title="비밀번호 변경" desc="6자 이상으로 정해 주세요" />
        <div className="px-4 pt-1 pb-4">
          <PasswordForm />
        </div>
      </Card>

      <form action={logoutAction}>
        <Button type="submit" variant="outline" size="lg" className="w-full text-danger">
          로그아웃
        </Button>
      </form>

      <p className="pt-2 text-center text-[11px] text-ink-4">
        BIG PICTURE 정산관리
      </p>
    </div>
  );
}
