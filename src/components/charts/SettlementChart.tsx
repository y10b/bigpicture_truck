"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortWon, tickDate, prettyDate, won } from "@/lib/format";
import type { DayTotals } from "@/lib/types";

/* 검증된 3계열 팔레트 — src/app/globals.css 의 --color-chart-* 와 같은 값 */
export const SERIES = [
  { key: "credit", label: "신용", color: "#2f7a45" },
  { key: "cod", label: "착불", color: "#c39412" },
  { key: "extra", label: "추가금", color: "#7a5cb5" },
] as const;

const SURFACE = "#ffffff";
const GRID = "#e7e5db";
const INK_3 = "#5b6169";
const INK_4 = "#8d949c";

const axisTick = { fontSize: 11, fill: INK_4, fontWeight: 600 };

export function ChartLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: s.color }}
          />
          <span className="text-[12px] font-semibold text-ink-3">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as DayTotals;
  return (
    <div className="rounded-xl border border-ink/10 bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1.5 text-[12px] font-bold">{prettyDate(String(label))}</p>
      <ul className="space-y-0.5">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: s.color }}
            />
            <span className="text-ink-3">{s.label}</span>
            <span className="tnum ml-auto font-bold text-ink">
              {won(row[s.key])}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-ink/8 pt-1.5">
        <span className="text-[12px] font-semibold text-ink-3">
          {row.count}건
        </span>
        <span className="tnum text-[13px] font-extrabold">{won(row.total)}원</span>
      </div>
    </div>
  );
}

/** 일별 정산액 — 신용/착불/추가금 누적 막대 */
export function AmountChart({ data }: { data: DayTotals[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="work_date"
          tickFormatter={tickDate}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          tickFormatter={(v) => shortWon(v as number)}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          content={<MoneyTooltip />}
          cursor={{ fill: "rgba(20,22,26,0.05)" }}
        />
        {SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color}
            /* 누적 구간 사이 2px 여백 대신 표면색 테두리로 분리 */
            stroke={SURFACE}
            strokeWidth={1}
            radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={26}
            /* 매번 들어올 때마다 자라나는 연출은 데이터 확인에 방해가 됩니다 */
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink/10 bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-bold">{prettyDate(String(label))}</p>
      <p className="tnum mt-0.5 text-[13px] font-extrabold text-ink">
        {payload[0].value}건
      </p>
    </div>
  );
}

/** 일별 건수 추이 — 단일 계열이므로 범례 없이 제목이 이름을 대신합니다 */
export function CountChart({ data }: { data: DayTotals[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="countFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f7a45" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#2f7a45" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="work_date"
          tickFormatter={tickDate}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={46}
          allowDecimals={false}
        />
        <Tooltip
          content={<CountTooltip />}
          cursor={{ stroke: INK_3, strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#2f7a45"
          strokeWidth={2}
          fill="url(#countFill)"
          dot={false}
          activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
