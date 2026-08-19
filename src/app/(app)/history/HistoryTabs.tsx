import Link from "next/link";
import { cn } from "@/components/ui";

/**
 * 내 내역 / 팀 내역 전환.
 * 아래 탭바를 여섯 칸으로 늘리는 대신, 같은 "내 내역" 안에서 오가게 합니다.
 */
export default function HistoryTabs({
  active,
  query,
}: {
  active: "me" | "team";
  /** 보고 있던 기간을 그대로 들고 넘어갑니다 */
  query: string;
}) {
  const tabs = [
    { key: "me" as const, href: `/history${query}`, label: "내 내역" },
    { key: "team" as const, href: `/history/team${query}`, label: "팀 내역" },
  ];

  return (
    <div className="flex gap-1.5 rounded-xl border border-ink/10 bg-paper-2/60 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-[13px] font-bold transition-colors",
            active === t.key
              ? "bg-card text-brand-600 shadow-[0_1px_2px_rgba(20,22,26,0.06)]"
              : "text-ink-4 active:bg-ink/5",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
