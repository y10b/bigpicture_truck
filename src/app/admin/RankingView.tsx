"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CheckBox,
  ListControls,
  useAdminList,
  type ListRow,
} from "@/components/admin/list-controls";
import { Badge, Card, CardHeader, Empty, cn } from "@/components/ui";
import { won } from "@/lib/format";
import type { Settlement } from "@/lib/settlement";

export type RankingRow = {
  user_id: string;
  name: string;
  phone: string;
  count: number;
  days: number;
  total: number;
  role: string;
  active: boolean;
  vehicle_no: string | null;
  vehicle_type: string | null;
  s: Settlement;
};

export default function RankingView({
  rows,
  desc,
  periodQuery,
  meId,
}: {
  rows: RankingRow[];
  desc: string;
  periodQuery: string;
  /** 로그인한 관리자 본인 — 목록에서 표시해 줍니다 */
  meId: string;
}) {
  const listRows: ListRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.user_id,
        name: r.name,
        phone: r.phone,
        vehicleNo: r.vehicle_no,
        vehicleType: r.vehicle_type,
        active: r.active,
        isAdmin: r.role === "admin",
        total: r.total,
        net: r.total,
        remaining: r.s.remaining,
      })),
    [rows],
  );

  const list = useAdminList(listRows);
  const byId = useMemo(
    () => new Map(rows.map((r) => [r.user_id, r])),
    [rows],
  );

  // 지금 화면에 보이는 사람들만의 합계 — 차종별로 묶어 볼 때 유용합니다.
  const shown = useMemo(() => {
    const ids = list.selected.size > 0 ? [...list.selected] : list.visible.map((r) => r.id);
    return ids.reduce(
      (a, id) => {
        const r = byId.get(id);
        if (!r) return a;
        return {
          n: a.n + 1,
          total: a.total + r.total,
          withdrawn: a.withdrawn + r.s.withdrawn,
          remaining: a.remaining + r.s.remaining,
        };
      },
      { n: 0, total: 0, withdrawn: 0, remaining: 0 },
    );
  }, [list.visible, list.selected, byId]);

  const summaryLabel =
    list.selected.size > 0
      ? `선택한 ${list.selected.size}명 합계`
      : list.filtering
        ? `조건에 맞는 ${shown.n}명 합계`
        : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader title="직원별 실적" desc={desc} />

      <div className="px-4 pb-3">
        <ListControls list={list} total={rows.length} />
      </div>

      {summaryLabel && (
        <div className="mx-4 mb-3 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-3">
          <p className="text-[12px] font-bold text-brand-700">{summaryLabel}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Sum label="매출" value={shown.total} strong />
            <Sum label="출금" value={shown.withdrawn} />
            <Sum label="미출금" value={shown.remaining} />
          </div>
        </div>
      )}

      {list.visible.length === 0 ? (
        <Empty icon="🔍" title="조건에 맞는 직원이 없습니다" />
      ) : (
        <ul className="divide-y divide-ink/6">
          {list.visible.map((v, i) => {
            const r = byId.get(v.id)!;
            return (
              <li
                key={v.id}
                className={cn(
                  "flex items-center gap-2.5 pr-4 pl-4",
                  v.id === meId && "bg-brand-50/60",
                )}
              >
                <CheckBox
                  checked={list.selected.has(v.id)}
                  onChange={() => list.toggle(v.id)}
                  label={`${r.name} 선택`}
                />
                <Link
                  href={`/admin/members/${r.user_id}?${periodQuery}`}
                  className="-mr-4 flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 transition-colors active:bg-paper-2"
                >
                  <span className="tnum w-5 shrink-0 text-[13px] font-extrabold text-ink-4">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[14px] font-bold">{r.name}</p>
                      {v.id === meId && <Badge tone="accent">나</Badge>}
                      {r.role === "admin" && <Badge tone="brand">관리자</Badge>}
                      {!r.active && <Badge>비활성</Badge>}
                      {r.vehicle_type && (
                        <Badge tone="neutral">{r.vehicle_type}</Badge>
                      )}
                    </div>
                    <p className="tnum mt-0.5 text-[12px] text-ink-4">
                      {r.count}건 · {r.days}일 근무
                    </p>
                    <p className="tnum mt-0.5 text-[12px] font-semibold text-ink-3">
                      출금 {won(r.s.withdrawn)} · 미출금{" "}
                      <span
                        className={cn(
                          "font-bold",
                          r.s.remaining < 0 && "text-danger",
                        )}
                      >
                        {r.s.remaining < 0
                          ? `−${won(-r.s.remaining)}`
                          : won(r.s.remaining)}
                      </span>
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[15px] font-extrabold">
                    {won(r.total)}
                    <span className="ml-0.5 text-[11px] font-semibold text-ink-4">
                      원
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold text-brand-700/70">{label}</span>
      <span
        className={
          strong
            ? "tnum text-[14px] font-extrabold text-brand-700"
            : "tnum text-[13px] font-bold text-ink-2"
        }
      >
        {won(value)}
      </span>
    </div>
  );
}
