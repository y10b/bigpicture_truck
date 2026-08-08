"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** 안 읽은 개수. 0이면 배지를 숨깁니다. */
  badge?: number;
  /** 하위 경로까지 활성으로 치지 않고 정확히 이 경로일 때만 활성 */
  exact?: boolean;
};

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-card/95 backdrop-blur-md">
      <ul className="safe-bottom mx-auto flex max-w-2xl pt-1.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-1 transition-colors",
                  active ? "text-brand-600" : "text-ink-4",
                )}
              >
                <span className="relative">
                  {item.icon}
                  {Boolean(item.badge) && (
                    <span
                      className="tnum absolute -top-1.5 -right-2.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-card"
                      aria-label={`안 읽은 공지 ${item.badge}건`}
                    >
                      {item.badge! > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-semibold">{item.label}</span>
                {active && (
                  <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-brand-500" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ── 아이콘 (외부 의존성 없이 인라인 SVG) ─────────────── */
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconTruck = (
  <svg {...base}>
    <path d="M3 7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9H3z" />
    <path d="M14 10h3.6a1 1 0 0 1 .8.4L21 14v2h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

export const IconChart = (
  <svg {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconMegaphone = (
  <svg {...base}>
    <path d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5L8 9H5a1 1 0 0 0-1 1Z" />
    <path d="M18 9a4 4 0 0 1 0 6" />
  </svg>
);

export const IconUser = (
  <svg {...base}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconUsers = (
  <svg {...base}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.5a3.2 3.2 0 0 1 0 6M17 20a6.6 6.6 0 0 0-1.6-4.3" />
  </svg>
);

export const IconGrid = (
  <svg {...base}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </svg>
);

export const IconList = (
  <svg {...base}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
