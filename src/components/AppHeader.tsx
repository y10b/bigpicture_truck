import Link from "next/link";
import type { Profile } from "@/lib/types";

export default function AppHeader({
  profile,
  subtitle,
  adminView = false,
}: {
  profile: Profile;
  subtitle?: string;
  adminView?: boolean;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 bg-ink text-paper">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href={adminView ? "/admin" : "/home"} className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="graffiti text-[17px] leading-none font-extrabold text-brand-300">
              BIG
            </span>
            <span className="graffiti text-[17px] leading-none font-extrabold text-paper">
              PICTURE
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] font-medium text-paper/55">
            {subtitle ?? (adminView ? "관리자" : "화물 일일 정산")}
          </p>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {profile.role === "admin" && (
            <Link
              href={adminView ? "/home" : "/admin"}
              className="rounded-lg border border-paper/20 px-2.5 py-1.5 text-[12px] font-semibold text-paper/85 transition-colors hover:bg-paper/10"
            >
              {adminView ? "직원 화면" : "관리자"}
            </Link>
          )}
          <Link
            href="/me"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-[13px] font-bold text-white"
            aria-label="내 정보"
          >
            {profile.name.slice(-2)}
          </Link>
        </div>
      </div>
    </header>
  );
}
