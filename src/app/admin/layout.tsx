import { requireAdmin } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import BottomNav, {
  IconGrid,
  IconMegaphone,
  IconTruck,
  IconUsers,
} from "@/components/BottomNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader profile={profile} adminView />
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      <BottomNav
        items={[
          { href: "/admin", label: "대시보드", icon: IconGrid, exact: true },
          { href: "/admin/members", label: "직원", icon: IconUsers },
          { href: "/admin/notices", label: "공지", icon: IconMegaphone },
          // 관리자도 직접 배송을 뛰므로 본인 정산 입력으로 바로 갑니다
          { href: "/home", label: "내 정산", icon: IconTruck },
        ]}
      />
    </div>
  );
}
