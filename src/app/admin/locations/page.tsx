import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TRACK_FROM_HOUR,
  TRACK_TO_HOUR,
  isWithinTrackingHours,
} from "@/lib/tracking";
import { todayKST } from "@/lib/format";
import type { DriverLocation, Profile } from "@/lib/types";
import { Card, Empty } from "@/components/ui";
import LocationList from "./LocationList";

export const metadata = { title: "직원 위치 · BIG PICTURE" };

export default async function LocationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const today = todayKST();
  const [{ data: locData }, { data: profileData }, { data: distData }] =
    await Promise.all([
      supabase.from("driver_locations").select("*"),
      supabase
        .from("profiles")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("daily_distance")
        .select("user_id, meters")
        .eq("work_date", today),
    ]);

  const locations = (locData ?? []) as DriverLocation[];
  const profiles = (profileData ?? []) as Profile[];
  const byUser = new Map(locations.map((l) => [l.user_id, l]));
  const distByUser = new Map(
    ((distData ?? []) as { user_id: string; meters: number }[]).map((d) => [
      d.user_id,
      d.meters,
    ]),
  );

  const rows = profiles.map((p) => ({
    profile: p,
    location: byUser.get(p.id) ?? null,
    meters: distByUser.get(p.id) ?? 0,
  }));

  const live = rows.filter((r) => r.location).length;
  const working = isWithinTrackingHours();

  return (
    <div className="space-y-4 rise">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[20px] font-extrabold tracking-tight">직원 위치</h1>
        <span className="text-[13px] font-semibold text-ink-4">
          <span className="tnum">{live}</span> / {rows.length}명
        </span>
      </div>

      <Card className={working ? "border-brand-200 bg-brand-50/60 px-4 py-3" : "px-4 py-3"}>
        <p className="text-[13px] leading-relaxed text-ink-3">
          {working ? (
            <>
              지금은 <b className="text-brand-700">근무시간</b>이라 위치가
              들어옵니다.
            </>
          ) : (
            <>
              지금은 근무시간이 아닙니다. 위치는{" "}
              <b>
                오전 {TRACK_FROM_HOUR}시 ~ 밤 {TRACK_TO_HOUR}시
              </b>{" "}
              에만 들어옵니다.
            </>
          )}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-4">
          움직인 거리가 150m를 넘을 때만 갱신됩니다. 차가 서 있으면 시각이
          멈춰 있는 게 정상입니다.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <Empty icon="📍" title="활성 직원이 없습니다" />
        </Card>
      ) : (
        <LocationList rows={rows} />
      )}
    </div>
  );
}
