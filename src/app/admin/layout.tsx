import { requireAdmin } from "@/lib/auth";
import { getUnsettledToday } from "@/lib/unsettled";
import AppHeader from "@/components/AppHeader";
import AdminReminders from "@/components/AdminReminders";
import BottomNav, {
  IconGrid,
  IconMapPin,
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
  // 어느 관리자 화면에 있든 알림이 잡히도록 여기서 한 번 봅니다.
  const unsettled = await getUnsettledToday();

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader profile={profile} adminView />
      <AdminReminders names={unsettled.map((u) => u.name)} />
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      <BottomNav
        items={[
          { href: "/admin", label: "대시보드", icon: IconGrid, exact: true },
          { href: "/admin/members", label: "직원", icon: IconUsers },
          { href: "/admin/locations", label: "위치", icon: IconMapPin },
          { href: "/admin/notices", label: "공지", icon: IconMegaphone },
          // 관리자도 직접 배송을 뛰므로 본인 정산 입력으로 바로 갑니다
          { href: "/home", label: "내 정산", icon: IconTruck },
        ]}
      />
    </div>
  );
}
