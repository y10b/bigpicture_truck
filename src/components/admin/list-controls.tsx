"use client";

import { useMemo, useState } from "react";
import { cn } from "@/components/ui";

/* ── 정렬 ─────────────────────────────────────────────── */

export const SORTS = [
  { key: "net-desc", label: "매출 많은 순" },
  { key: "net-asc", label: "매출 적은 순" },
  { key: "total-desc", label: "건수 많은 순" },
  { key: "remaining-desc", label: "미출금 많은 순" },
  { key: "name-asc", label: "이름순" },
] as const;

export type SortKey = (typeof SORTS)[number]["key"];

/** 목록에 들어가는 한 사람 — 정렬·필터에 필요한 값만 추립니다. */
export type ListRow = {
  id: string;
  name: string;
  phone: string;
  vehicleNo: string | null;
  vehicleType: string | null;
  active: boolean;
  isAdmin: boolean;
  total: number;
  net: number;
  remaining: number;
};

export type StatusFilter = "all" | "active" | "inactive";

/** 차종이 안 적힌 사람을 묶는 표식 */
export const NO_VEHICLE = "__none__";

/**
 * 관리자 목록의 정렬·필터·선택 상태를 한곳에서 관리합니다.
 * 직원 목록과 대시보드 실적표가 같은 조작 방식을 쓰도록 공유합니다.
 */
export function useAdminList(rows: ListRow[]) {
  const [sort, setSort] = useState<SortKey>("net-desc");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** 선택한 사람을 어떻게 다룰지 — 보기만 / 숨기기 / 아무것도 안 함 */
  const [selectionMode, setSelectionMode] = useState<"off" | "only" | "hide">("off");

  const vehicleTypes = useMemo(() => {
    const set = new Set<string>();
    let hasNone = false;
    for (const r of rows) {
      if (r.vehicleType) set.add(r.vehicleType);
      else hasNone = true;
    }
    const list = [...set].sort((a, b) => a.localeCompare(b, "ko"));
    return hasNone ? [...list, NO_VEHICLE] : list;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");

    let out = rows.filter((r) => {
      if (status === "active" && !r.active) return false;
      if (status === "inactive" && r.active) return false;

      if (vehicles.length > 0) {
        const key = r.vehicleType ?? NO_VEHICLE;
        if (!vehicles.includes(key)) return false;
      }

      if (q) {
        const hay = [r.name, r.vehicleNo ?? "", r.vehicleType ?? ""]
          .join(" ")
          .toLowerCase();
        const phoneHit = digits.length >= 2 && r.phone.includes(digits);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      return true;
    });

    if (selectionMode === "only") out = out.filter((r) => selected.has(r.id));
    if (selectionMode === "hide") out = out.filter((r) => !selected.has(r.id));

    const by = {
      "net-desc": (a: ListRow, b: ListRow) => b.net - a.net,
      "net-asc": (a: ListRow, b: ListRow) => a.net - b.net,
      "total-desc": (a: ListRow, b: ListRow) => b.total - a.total,
      "remaining-desc": (a: ListRow, b: ListRow) => b.remaining - a.remaining,
      "name-asc": (a: ListRow, b: ListRow) => a.name.localeCompare(b.name, "ko"),
    }[sort];

    return [...out].sort(by);
  }, [rows, status, vehicles, query, sort, selected, selectionMode]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const ids = visible.map((r) => r.id);
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  const clear = () => {
    setSelected(new Set());
    setSelectionMode("off");
  };

  const reset = () => {
    setStatus("all");
    setVehicles([]);
    setQuery("");
    setSort("net-desc");
    clear();
  };

  const filtering =
    status !== "all" || vehicles.length > 0 || query.trim() !== "" || selectionMode !== "off";

  return {
    sort, setSort,
    status, setStatus,
    vehicles, setVehicles,
    query, setQuery,
    vehicleTypes,
    visible,
    selected, toggle, toggleAll, clear,
    selectionMode, setSelectionMode,
    filtering, reset,
  };
}

/* ── UI ───────────────────────────────────────────────── */

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-[12px] font-bold whitespace-nowrap transition-colors",
        active
          ? "bg-ink text-paper"
          : "border border-ink/10 bg-card text-ink-3 active:bg-paper-2",
      )}
    >
      {children}
    </button>
  );
}

export function CheckBox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
        checked || indeterminate
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-ink/20 bg-card",
      )}
    >
      {indeterminate ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      ) : checked ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5.5 5.5L20 6.5" />
        </svg>
      ) : null}
    </button>
  );
}

export function ListControls({
  list,
  total,
}: {
  list: ReturnType<typeof useAdminList>;
  /** 필터 전 전체 인원 */
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const visibleIds = list.visible.map((r) => r.id);
  const allChecked =
    visibleIds.length > 0 && visibleIds.every((id) => list.selected.has(id));
  const someChecked = visibleIds.some((id) => list.selected.has(id));

  return (
    <div className="space-y-2">
      {/* 정렬 + 필터 열기 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={list.sort}
            onChange={(e) => list.setSort(e.target.value as SortKey)}
            className="h-10 w-full appearance-none rounded-xl border border-ink/12 bg-card pr-8 pl-3 text-[13px] font-bold text-ink"
            aria-label="정렬 기준"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-4"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition-colors",
            list.filtering
              ? "bg-brand-500 text-white"
              : "border border-ink/12 bg-card text-ink-2",
          )}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          필터
          {list.filtering && (
            <span className="tnum rounded-full bg-white/25 px-1.5 text-[11px]">
              {list.visible.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-card p-3.5 rise">
          <input
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="이름 · 번호 · 차량번호로 찾기"
            className="h-10 w-full rounded-xl border border-ink/12 bg-paper-2/50 px-3 text-[14px] placeholder:text-ink-4 focus:border-brand-400 focus:outline-none"
          />

          <div>
            <p className="mb-1.5 text-[12px] font-bold text-ink-3">상태</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "전체"],
                  ["active", "활성"],
                  ["inactive", "비활성"],
                ] as const
              ).map(([k, label]) => (
                <Chip
                  key={k}
                  active={list.status === k}
                  onClick={() => list.setStatus(k)}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>

          {list.vehicleTypes.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-bold text-ink-3">
                차종{" "}
                <span className="font-normal text-ink-4">
                  (여러 개 고를 수 있습니다)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.vehicleTypes.map((v) => (
                  <Chip
                    key={v}
                    active={list.vehicles.includes(v)}
                    onClick={() =>
                      list.setVehicles(
                        list.vehicles.includes(v)
                          ? list.vehicles.filter((x) => x !== v)
                          : [...list.vehicles, v],
                      )
                    }
                  >
                    {v === NO_VEHICLE ? "차종 미등록" : v}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-ink/8 pt-3">
            <span className="text-[12px] text-ink-4">
              {list.visible.length}명 / 전체 {total}명
            </span>
            <button
              type="button"
              onClick={list.reset}
              className="text-[12px] font-bold text-ink-3 underline underline-offset-2"
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}

      {/* 전체 선택 줄 */}
      <div className="flex items-center gap-2.5 px-1">
        <CheckBox
          checked={allChecked}
          indeterminate={!allChecked && someChecked}
          onChange={list.toggleAll}
          label="보이는 직원 전체 선택"
        />
        <span className="text-[13px] font-semibold text-ink-3">
          {list.selected.size > 0 ? (
            <>
              <span className="tnum font-extrabold text-ink">
                {list.selected.size}
              </span>
              명 선택됨
            </>
          ) : (
            "전체 선택"
          )}
        </span>

        {list.selected.size > 0 && (
          <div className="ml-auto flex gap-1.5">
            <Chip
              active={list.selectionMode === "only"}
              onClick={() =>
                list.setSelectionMode(
                  list.selectionMode === "only" ? "off" : "only",
                )
              }
            >
              선택만 보기
            </Chip>
            <Chip
              active={list.selectionMode === "hide"}
              onClick={() =>
                list.setSelectionMode(
                  list.selectionMode === "hide" ? "off" : "hide",
                )
              }
            >
              숨기기
            </Chip>
            <button
              type="button"
              onClick={list.clear}
              className="rounded-full px-2 py-1.5 text-[12px] font-bold text-ink-4"
            >
              해제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
