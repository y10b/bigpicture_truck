"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, cn } from "@/components/ui";
import KakaoMap, { type MapPoint } from "@/components/KakaoMap";
import { useAddresses } from "@/components/kakao-sdk";
import { prettyDateTime } from "@/lib/format";
import type { DriverLocation, Profile } from "@/lib/types";

type Row = {
  profile: Profile;
  location: DriverLocation | null;
  /** 오늘 주행거리(m) */
  meters: number;
};

/** "3분 전" 처럼 얼마나 오래됐는지 */
function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

/** 오래된 위치는 흐리게 — 지금 위치라고 착각하면 안 됩니다 */
function staleness(iso: string) {
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min <= 15) return "fresh" as const;
  if (min <= 120) return "old" as const;
  return "stale" as const;
}

export default function LocationList({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);

  // 화면을 열어둔 채로 두는 경우가 많아 1분마다 새로 받아옵니다.
  // tick 은 "3분 전" 같은 글자를 다시 계산시키는 용도라 값 자체는 안 씁니다.
  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
      setTick((n) => n + 1);
    }, 60_000);
    return () => clearInterval(t);
  }, [router]);
  void tick;

  const withLoc = rows.filter((r) => r.location);
  const without = rows.filter((r) => !r.location);

  // 지도에 찍을 핀. 이름 아래에는 언제 들어온 위치인지만 짧게 붙입니다.
  // rows 가 그대로면 핀도 그대로 — 매 렌더마다 지도를 다시 그리지 않게 합니다.
  const points: MapPoint[] = useMemo(
    () =>
      rows
        .filter((r) => r.location)
        .map(({ profile, location, meters }) => ({
          id: profile.id,
          name: profile.name,
          lat: location!.lat,
          lng: location!.lng,
          caption:
            ago(location!.recorded_at) +
            (meters > 0 ? ` · ${Math.round(meters / 100) / 10}km` : ""),
          fresh: staleness(location!.recorded_at) === "fresh",
        })),
    [rows],
  );

  // 좌표는 사람이 못 읽습니다. 지금 어느 동네인지가 알고 싶은 전부입니다.
  const addresses = useAddresses(points);

  return (
    // key 로 통째로 갈아끼우면 지도까지 다시 만들어지므로 그냥 다시 그립니다.
    <div className="space-y-3">
      {points.length > 0 && (
        <KakaoMap points={points} focusId={focusId} className="h-[46vh] min-h-[260px]" />
      )}

      {withLoc.length > 0 && (
        <ul className="space-y-2">
          {withLoc.map(({ profile, location, meters }) => {
            const l = location!;
            const state = staleness(l.recorded_at);
            const kakao = `https://map.kakao.com/link/map/${encodeURIComponent(profile.name)},${l.lat},${l.lng}`;
            return (
              <li key={profile.id}>
                <Card
                  onClick={() => setFocusId(profile.id)}
                  className={cn(
                    "cursor-pointer p-4 transition-colors",
                    focusId === profile.id && "border-brand-300 bg-brand-50/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-extrabold">
                          {profile.name}
                        </span>
                        {profile.vehicle_type && (
                          <Badge tone="neutral">{profile.vehicle_type}</Badge>
                        )}
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                            state === "fresh"
                              ? "bg-brand-50 text-brand-600"
                              : state === "old"
                                ? "bg-accent-soft text-accent-deep"
                                : "bg-ink/6 text-ink-4",
                          )}
                        >
                          {ago(l.recorded_at)}
                        </span>
                      </div>

                      {profile.vehicle_no && (
                        <p className="mt-0.5 text-[12px] text-ink-4">
                          🚚 {profile.vehicle_no}
                        </p>
                      )}
                      {meters > 0 && (
                        <p className="tnum mt-1 text-[12px] font-bold text-ink-2">
                          오늘 {Math.round(meters / 100) / 10}km 주행
                        </p>
                      )}
                      <p className="mt-1 text-[13px] leading-snug font-semibold text-ink-2">
                        📍{" "}
                        {addresses[profile.id] ?? (
                          <span className="font-normal text-ink-4">
                            주소 확인 중…
                          </span>
                        )}
                      </p>
                      <p className="tnum mt-0.5 text-[11px] text-ink-4">
                        {prettyDateTime(l.recorded_at)}
                        {l.speed && l.speed > 1
                          ? ` · ${Math.round(l.speed * 3.6)}km/h`
                          : ""}
                      </p>
                    </div>

                    {/* 카드를 누르면 위 지도가 움직이고, 이 버튼은 카카오맵 앱으로 넘깁니다 */}
                    <a
                      href={kakao}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="outline" size="sm">
                        카카오맵
                      </Button>
                    </a>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {without.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-ink/8 px-4 py-3">
            <p className="text-[13px] font-bold text-ink-2">
              위치 없음{" "}
              <span className="tnum font-semibold text-ink-4">
                {without.length}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-4">
              앱을 아직 안 깔았거나, 위치 공유를 껐거나, 오늘 아직 앱을 열지
              않은 경우입니다.
            </p>
          </div>
          <ul className="divide-y divide-ink/6">
            {without.map(({ profile }) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="text-[14px] font-semibold">{profile.name}</span>
                {!profile.share_location && <Badge>공유 꺼둠</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
