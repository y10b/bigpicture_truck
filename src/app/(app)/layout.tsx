import { requireSettledProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import LocationTracker from "@/components/LocationTracker";
import BottomNav, {
  IconChart,
  IconMegaphone,
  IconSparkle,
  IconTruck,
  IconUser,
} from "@/components/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSettledProfile();

  // 마지막으로 공지 목록을 연 시점 이후에 올라온 공지 개수를 셉니다.
  // head + count 라서 본문은 안 받아오고 숫자만 옵니다.
  const supabase = await createClient();
  const { count } = await supabase
    .from("notices")
    .select("id", { count: "exact", head: true })
    .gt("created_at", profile.notices_seen_at ?? "1970-01-01T00:00:00Z");

  const unread = count ?? 0;

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader profile={profile} />
      <LocationTracker enabled={profile.share_location} />
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      <BottomNav
        items={[
          { href: "/home", label: "정산입력", icon: IconTruck },
          { href: "/history", label: "내 내역", icon: IconChart },
          { href: "/feedback", label: "피드백", icon: IconSparkle },
          {
            href: "/notices",
            label: "공지사항",
            icon: IconMegaphone,
            badge: unread,
          },
          { href: "/me", label: "내 정보", icon: IconUser },
        ]}
      />
    </div>
  );
}
