"use client";

import { useMemo } from "react";
import {
  CheckBox,
  ListControls,
  useAdminList,
  type ListRow,
} from "@/components/admin/list-controls";
import { Card, Empty } from "@/components/ui";
import { won } from "@/lib/format";
import type { Settlement } from "@/lib/settlement";
import type { Profile } from "@/lib/types";
import MemberCard from "./MemberCard";

export default function MembersView({
  profiles,
  stats,
  meId,
}: {
  profiles: Profile[];
  /** user_id → 이번 달 정산 요약 */
  stats: Record<string, Settlement>;
  meId: string;
}) {
  const rows: ListRow[] = useMemo(
    () =>
      profiles.map((p) => {
        const s = stats[p.id];
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          vehicleNo: p.vehicle_no,
          vehicleType: p.vehicle_type,
          active: p.active,
          isAdmin: p.role === "admin",
          total: s?.total ?? 0,
          net: s?.total ?? 0,
          remaining: s?.remaining ?? 0,
        };
      }),
    [profiles, stats],
  );

  const list = useAdminList(rows);
  const byId = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  // 선택한 사람들의 이번 달 합계 — 팀 단위로 묶어 볼 때 씁니다.
  const picked = useMemo(() => {
    const ids = [...list.selected];
    if (ids.length === 0) return null;
    return ids.reduce(
      (a, id) => {
        const s = stats[id];
        if (!s) return a;
        return {
          total: a.total + s.total,
          withdrawn: a.withdrawn + s.withdrawn,
          remaining: a.remaining + s.remaining,
        };
      },
      { total: 0, withdrawn: 0, remaining: 0 },
    );
  }, [list.selected, stats]);

  return (
    <div className="space-y-3">
      <ListControls list={list} total={profiles.length} />

      {picked && (
        <Card className="border-brand-200 bg-brand-50/70 px-4 py-3">
          <p className="text-[12px] font-bold text-brand-700">
            선택한 {list.selected.size}명 · 이번 달 합계
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <Sum label="매출" value={picked.total} strong />
            <Sum label="출금" value={picked.withdrawn} />
            <Sum label="미출금" value={picked.remaining} />
          </div>
        </Card>
      )}

      {list.visible.length === 0 ? (
        <Card>
          <Empty
            icon="🔍"
            title="조건에 맞는 직원이 없습니다"
            desc="필터를 바꾸거나 초기화해 보세요."
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {list.visible.map((r) => {
            const p = byId.get(r.id);
            if (!p) return null;
            return (
              <li key={r.id} className="flex items-start gap-2.5">
                <div className="pt-4">
                  <CheckBox
                    checked={list.selected.has(r.id)}
                    onChange={() => list.toggle(r.id)}
                    label={`${r.name} 선택`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <MemberCard
                    profile={p}
                    stat={stats[r.id]}
                    isMe={r.id === meId}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Sum({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-brand-700/70">{label}</p>
      <p
        className={
          strong
            ? "tnum text-[14px] font-extrabold text-brand-700"
            : "tnum text-[13px] font-bold text-ink-2"
        }
      >
        {won(value)}
      </p>
    </div>
  );
}
