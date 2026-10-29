import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolvePeriod } from "@/lib/period";
import { dateRange, endOfMonth } from "@/lib/format";
import type { DayTotals, Profile, Withdrawal } from "@/lib/types";

/** 엑셀에 찍을 요일 (0=일) */
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 관리자용 엑셀 내려받기.
 *
 * 직원 한 명당 탭 하나. 각 탭은 날짜가 하루씩 내려가고,
 * 가로로 신용 · 착불 · 추가금 · 합계 · 출금 · 누적 근무일수가 붙습니다.
 * 근무일수는 '그날 일했는가'(건수나 금액이 있으면 근무)로 셉니다.
 *
 * ⚠️ PostgREST 는 한 번에 1000행까지만 주므로, 기간이 길면 나눠 받아야
 *    합니다 (10명 × 1년 = 3650행). fetchAll 이 그 일을 합니다.
 */

/**
 * 1000행 제한을 넘겨도 빠짐없이 받아오게 나눠 조회합니다.
 * 호출부가 (시작, 끝) 범위를 받아 조회를 실행해 주면 됩니다.
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const SIZE = 1000;
  const out: T[] = [];
  for (let i = 0; i < 50; i++) {
    const { data, error } = await page(i * SIZE, i * SIZE + SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < SIZE) break;
  }
  return out;
}

/** 엑셀 시트 이름에 못 쓰는 글자를 걷어냅니다 (31자 제한). */
function sheetName(name: string, used: Set<string>) {
  let base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "직원";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base} ${n++}`.slice(0, 31);
  used.add(candidate);
  return candidate;
}

const MONEY = "#,##0";

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  // 개인 거래·추가금은 빼고 뽑아야 할 때가 있습니다. 빼면 칸도 합계도 빠집니다.
  // 값이 없으면 넣는 쪽이 기본입니다 (예전 주소로 눌러도 전처럼 나옵니다).
  const withCash = url.searchParams.get("cash") !== "0";
  const withExtra = url.searchParams.get("extra") !== "0";

  const period = resolvePeriod(
    url.searchParams.get("period") ?? undefined,
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );

  const supabase = await createClient();

  const [profileData, daily, withdrawals, leaves] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("name", { ascending: true })
      .then((r) => (r.data ?? []) as Profile[]),
    fetchAll<DayTotals & { user_id: string }>((from, to) =>
      supabase
        .from("v_daily_totals")
        .select("user_id, work_date, count, credit, cod, extra, cash, total, taxable_credit, taxable_cod, taxable_extra, taxable_cash")
        .gte("work_date", period.from)
        .lte("work_date", period.to)
        .order("work_date", { ascending: true })
        .range(from, to),
    ),
    fetchAll<Withdrawal>((from, to) =>
      supabase
        .from("withdrawals")
        .select("*")
        .gte("work_date", period.from)
        .lte("work_date", period.to)
        .order("work_date", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ user_id: string; leave_date: string }>((from, to) =>
      supabase
        .from("leaves")
        .select("user_id, leave_date")
        .gte("leave_date", period.from)
        .lte("leave_date", period.to)
        .order("leave_date", { ascending: true })
        .range(from, to),
    ),
  ]);

  const days = dateRange(period.from, period.to);

  // user_id → (날짜 → 값)
  const byUser = new Map<string, Map<string, DayTotals>>();
  for (const d of daily) {
    const m = byUser.get(d.user_id) ?? new Map();
    m.set(d.work_date, d);
    byUser.set(d.user_id, m);
  }
  const wdByUser = new Map<string, Map<string, number>>();
  for (const w of withdrawals) {
    const m = wdByUser.get(w.user_id) ?? new Map();
    m.set(w.work_date, (m.get(w.work_date) ?? 0) + w.amount);
    wdByUser.set(w.user_id, m);
  }

  const leaveByUser = new Map<string, Set<string>>();
  for (const l of leaves) {
    const set = leaveByUser.get(l.user_id) ?? new Set<string>();
    set.add(l.leave_date);
    leaveByUser.set(l.user_id, set);
  }

  // 기록이 하나도 없는 사람은 탭을 만들지 않습니다 (빈 탭이 늘어나면 보기 나쁩니다)
  const targets = profileData.filter(
    (p) => byUser.has(p.id) || wdByUser.has(p.id) || leaveByUser.has(p.id),
  );

  // 20일 기준은 한 달을 통째로 뽑을 때만 뜻이 있습니다.
  // 한 주나 임의 기간을 뽑아 놓고 "20일 미달" 이라고 적으면 오해를 삽니다.
  const isWholeMonth =
    period.from.endsWith("-01") &&
    period.from.slice(0, 7) === period.to.slice(0, 7) &&
    period.to === endOfMonth(period.from);
  const MIN_DAYS = 20;

  // 항목을 빼면 칸 번호가 밀립니다. 고정 숫자를 쓰면 금방 어긋나서 여기서 셉니다.
  const col = (() => {
    let c = 5; // 1 날짜 · 2 요일 · 3 신용 · 4 착불
    const cash = withCash ? c++ : 0;
    const extra = withExtra ? c++ : 0;
    return {
      cash, extra,
      total: c++, tax: c++, withdrawn: c++, days: c++, note: c++,
    };
  })();
  const sumCol = (() => {
    let c = 4; // 1 이름 · 2 신용 · 3 착불
    const cash = withCash ? c++ : 0;
    const extra = withExtra ? c++ : 0;
    return {
      cash, extra,
      total: c++, taxIn: c++, taxOut: c++, withdrawn: c++,
      days: c++, weekday: c++, weekend: c++, leave: c++, minDays: c++,
    };
  })();

  const wb = new ExcelJS.Workbook();
  wb.creator = "BIG PICTURE 정산관리";
  wb.created = new Date();

  /* ── 전체 요약 (맨 앞 탭) ─────────────────────────── */
  const summary = wb.addWorksheet("전체 요약", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  // 칸 수가 달라지므로 병합 범위도 같이 움직입니다
  const colLetter = (n: number) => String.fromCharCode(64 + n);
  summary.mergeCells(`A1:${colLetter(sumCol.minDays)}1`);
  summary.getCell("A1").value = `BIG PICTURE 정산 — ${period.label}`;
  summary.getCell("A1").font = { size: 14, bold: true };
  summary.getCell("A2").value = `${period.from} ~ ${period.to}`;
  summary.getCell("A2").font = { size: 10, color: { argb: "FF888888" } };

  const sumHeader = [
    "이름", "신용", "착불",
    ...(withCash ? ["개인거래"] : []),
    ...(withExtra ? ["추가금"] : []),
    "합계", "신고대상", "신고제외", "출금",
    "근무일수", "평일", "주말·휴일", "월차",
    ...(isWholeMonth ? [`${MIN_DAYS}일 충족`] : []),
  ];
  summary.getRow(3).values = sumHeader;
  summary.columns = [
    { width: 14 }, { width: 13 }, { width: 13 },
    ...(withCash ? [{ width: 13 }] : []),
    ...(withExtra ? [{ width: 12 }] : []),
    { width: 15 }, { width: 14 }, { width: 14 }, { width: 13 },
    { width: 11 }, { width: 9 }, { width: 11 }, { width: 13 },
    ...(isWholeMonth ? [{ width: 11 }] : []),
  ];

  const styleHeader = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.height = 22;
    row.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14161A" } };
      c.border = { bottom: { style: "thin", color: { argb: "FF444444" } } };
    });
  };
  styleHeader(summary.getRow(3));

  const totals = {
    credit: 0, cod: 0, extra: 0, cash: 0, total: 0, taxable: 0, withdrawn: 0,
    days: 0, weekday: 0, weekend: 0,
  };

  /* ── 직원별 탭 ────────────────────────────────────── */
  const used = new Set<string>(["전체 요약"]);

  for (const p of targets) {
    const mine = byUser.get(p.id) ?? new Map<string, DayTotals>();
    const myWd = wdByUser.get(p.id) ?? new Map<string, number>();
    const myLeave = leaveByUser.get(p.id) ?? new Set<string>();

    const ws = wb.addWorksheet(sheetName(p.name, used), {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    ws.mergeCells(`A1:${colLetter(col.note)}1`);
    ws.getCell("A1").value = `${p.name} — ${period.label}`;
    ws.getCell("A1").font = { size: 13, bold: true };
    ws.getCell("A2").value = [
      p.vehicle_no,
      p.vehicle_type,
      p.bank_account,
    ]
      .filter(Boolean)
      .join("  ·  ");
    ws.getCell("A2").font = { size: 10, color: { argb: "FF888888" } };

    ws.getRow(4).values = [
      "날짜", "요일", "신용", "착불",
      ...(withCash ? ["개인거래"] : []),
      ...(withExtra ? ["추가금"] : []),
      "합계", "신고", "출금", "누적 근무일수", "비고",
    ];
    ws.columns = [
      { width: 13 }, { width: 7 }, { width: 12 }, { width: 12 },
      ...(withCash ? [{ width: 12 }] : []),
      ...(withExtra ? [{ width: 12 }] : []),
      { width: 14 }, { width: 7 }, { width: 13 }, { width: 13 }, { width: 10 },
    ];
    styleHeader(ws.getRow(4));

    // 누적 근무일수 — 그날까지 며칠 일했는지
    let worked = 0;
    const acc = {
      credit: 0, cod: 0, extra: 0, cash: 0, total: 0, taxable: 0, withdrawn: 0,
      days: 0, weekday: 0, weekend: 0,
    };
    let r = 5;

    for (const date of days) {
      const d = mine.get(date);
      const wd = myWd.get(date) ?? 0;
      const onLeave = myLeave.has(date);
      // 아무 일도 없던 날은 줄을 만들지 않습니다 (한 달이면 빈 줄이 절반)
      if (!d && wd === 0 && !onLeave) continue;

      const credit = d?.credit ?? 0;
      const cod = d?.cod ?? 0;
      const extra = withExtra ? (d?.extra ?? 0) : 0;
      const cash = withCash ? (d?.cash ?? 0) : 0;
      const total = credit + cod + extra + cash;
      // 신고 대상도 뺀 항목을 빼고 셉니다. 안 그러면 합계와 안 맞습니다.
      const taxable =
        (d?.taxable_credit ?? 0) +
        (d?.taxable_cod ?? 0) +
        (withCash ? (d?.taxable_cash ?? 0) : 0) +
        (withExtra ? (d?.taxable_extra ?? 0) : 0);

      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      // 건수든 금액이든 하나라도 있으면 그날 일한 것으로 봅니다.
      // (출금만 있는 날은 근무로 세지 않습니다)
      const didWork = (d?.count ?? 0) > 0 || total > 0;
      if (didWork) {
        worked += 1;
        acc.days += 1;
        if (weekend) acc.weekend += 1;
        else acc.weekday += 1;
      }

      acc.credit += credit;
      acc.cod += cod;
      acc.extra += extra;
      acc.cash += cash;
      acc.total += total;
      acc.taxable += taxable;
      acc.withdrawn += wd;

      const row = ws.getRow(r++);
      row.values = [
        date, WEEKDAY[dow], credit, cod,
        ...(withCash ? [cash] : []),
        ...(withExtra ? [extra] : []),
        total,
        // 관리자가 신고 대상으로 체크한 금액이 있으면 O
        taxable > 0 ? "O" : null,
        wd || null,
        didWork ? worked : null,
        onLeave ? "월차" : null,
      ];
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      for (let c = 3; c <= col.total; c++) row.getCell(c).numFmt = MONEY;
      row.getCell(col.total).font = { bold: true };
      row.getCell(col.withdrawn).numFmt = MONEY;
      for (const c of [col.tax, col.days, col.note]) {
        row.getCell(c).alignment = { horizontal: "center" };
      }
      if (taxable > 0) {
        row.getCell(col.tax).font = { bold: true, color: { argb: "FF2F7A45" } };
      }
      if (wd > 0) {
        row.getCell(col.withdrawn).font = {
          bold: true, color: { argb: "FF2F7A45" },
        };
      }
      if (onLeave) {
        row.getCell(col.note).font = { bold: true, color: { argb: "FF9A6B00" } };
      }
      // 주말은 옅게 칠해 한 주 단위를 눈으로 끊을 수 있게
      if (weekend) {
        row.eachCell((c) => {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF6F5F0" },
          };
        });
      }
    }

    // 합계 줄
    const totalRow = ws.getRow(r);
    totalRow.values = [
      "합계", "", acc.credit, acc.cod,
      ...(withCash ? [acc.cash] : []),
      ...(withExtra ? [acc.extra] : []),
      acc.total, "", acc.withdrawn, acc.days,
      myLeave.size > 0 ? `월차 ${myLeave.size}일` : null,
    ];
    totalRow.font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: "center" };
    totalRow.getCell(col.days).alignment = { horizontal: "center" };
    for (let c = 3; c <= col.total; c++) totalRow.getCell(c).numFmt = MONEY;
    totalRow.getCell(col.withdrawn).numFmt = MONEY;
    totalRow.eachCell((c) => {
      c.border = { top: { style: "double", color: { argb: "FF14161A" } } };
    });

    // 근무일수는 평일/주말로 나눠 한 줄 더 적어 둡니다
    const breakdown = ws.getRow(r + 1);
    breakdown.getCell(1).value = "근무일수";
    breakdown.getCell(1).alignment = { horizontal: "center" };
    // 신고 대상/제외를 한 줄로 따로 적어 둡니다
    const taxRow = ws.getRow(r + 2);
    taxRow.getCell(1).value = "세금";
    taxRow.getCell(1).alignment = { horizontal: "center" };
    taxRow.getCell(3).value =
      `신고 대상 ${acc.taxable.toLocaleString()}원  ·  신고 제외 ${(acc.total - acc.taxable).toLocaleString()}원`;
    taxRow.font = { bold: true, color: { argb: "FF14161A" } };

    const leaveDates = [...myLeave].sort();
    breakdown.getCell(3).value = [
      `총 ${acc.days}일`,
      `평일 ${acc.weekday}일`,
      `주말·휴일 ${acc.weekend}일`,
      leaveDates.length > 0 ? `월차 ${leaveDates.join(", ")}` : null,
      // 20일 기준은 한 달을 통째로 뽑았을 때만 적습니다
      isWholeMonth
        ? acc.days >= MIN_DAYS
          ? `${MIN_DAYS}일 충족`
          : `${MIN_DAYS}일 미달 (${MIN_DAYS - acc.days}일 부족)`
        : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    breakdown.font = {
      bold: true,
      color: {
        argb:
          isWholeMonth && acc.days < MIN_DAYS ? "FFB3261E" : "FF2F7A45",
      },
    };

    // 요약 탭에 한 줄 추가
    const sRow = summary.getRow(summary.rowCount + 1);
    const leaveLabel =
      myLeave.size === 0
        ? "—"
        : [...myLeave].sort().map((d) => d.slice(5)).join(", ");
    sRow.values = [
      p.name, acc.credit, acc.cod,
      ...(withCash ? [acc.cash] : []),
      ...(withExtra ? [acc.extra] : []),
      acc.total, acc.taxable, acc.total - acc.taxable, acc.withdrawn,
      acc.days, acc.weekday, acc.weekend, leaveLabel,
      ...(isWholeMonth ? [acc.days >= MIN_DAYS ? "O" : "X"] : []),
    ];
    for (let c = 2; c <= sumCol.withdrawn; c++) sRow.getCell(c).numFmt = MONEY;
    sRow.getCell(sumCol.total).font = { bold: true };
    for (let c = sumCol.days; c <= sumCol.minDays; c++)
      sRow.getCell(c).alignment = { horizontal: "center" };
    // 월차를 썼는데 20일을 못 채운 사람은 눈에 띄게
    if (isWholeMonth && acc.days < MIN_DAYS) {
      sRow.getCell(sumCol.minDays).font = {
        bold: true, color: { argb: "FFB3261E" },
      };
      if (myLeave.size > 0) {
        sRow.getCell(sumCol.leave).font = {
          bold: true, color: { argb: "FFB3261E" },
        };
      }
    }

    totals.credit += acc.credit;
    totals.cod += acc.cod;
    totals.extra += acc.extra;
    totals.cash += acc.cash;
    totals.total += acc.total;
    totals.taxable += acc.taxable;
    totals.withdrawn += acc.withdrawn;
    totals.days += acc.days;
    totals.weekday += acc.weekday;
    totals.weekend += acc.weekend;
  }

  // 요약 합계 줄
  const sTotal = summary.getRow(summary.rowCount + 1);
  sTotal.values = [
    "전체",
    totals.credit,
    totals.cod,
    ...(withCash ? [totals.cash] : []),
    ...(withExtra ? [totals.extra] : []),
    totals.total,
    totals.taxable,
    totals.total - totals.taxable,
    totals.withdrawn,
    totals.days,
    totals.weekday,
    totals.weekend,
    leaves.length > 0 ? `${leaves.length}건` : "—",
    ...(isWholeMonth ? [""] : []),
  ];
  sTotal.font = { bold: true };
  for (let c = 2; c <= sumCol.withdrawn; c++) sTotal.getCell(c).numFmt = MONEY;
  for (let c = sumCol.days; c <= sumCol.minDays; c++)
    sTotal.getCell(c).alignment = { horizontal: "center" };
  sTotal.eachCell((c) => {
    c.border = { top: { style: "double", color: { argb: "FF14161A" } } };
  });

  if (targets.length === 0) {
    summary.getCell("A4").value = "이 기간에는 기록이 없습니다.";
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `빅픽처_정산_${period.from}_${period.to}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // 한글 파일명은 filename* 로 줘야 브라우저가 제대로 받습니다
      "Content-Disposition": `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
