import Image from "next/image";
import { redirect } from "next/navigation";
import logo from "@/assets/logo.png";
import { requireProfile } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { Button, Card } from "@/components/ui";
import SetupForm from "./SetupForm";

export const metadata = { title: "비밀번호 설정 · BIG PICTURE" };

export default async function PasswordSetupPage() {
  const profile = await requireProfile();

  // 이미 본인 비밀번호를 쓰고 있으면 여기 머물 이유가 없습니다.
  if (!profile.must_change_password) {
    redirect(profile.role === "admin" ? "/admin" : "/home");
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm rise">
        <div className="mb-6 flex flex-col items-center">
          <Image src={logo} alt="BIG PICTURE" priority className="h-24 w-auto" />
        </div>

        <Card className="p-5">
          <h1 className="text-[18px] font-extrabold tracking-tight">
            {profile.name}님, 비밀번호를 정해 주세요
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
            지금 쓰신 건 관리자가 발급한 <b>임시 비밀번호</b>입니다.
            <br />
            본인만 아는 비밀번호로 바꿔야 계속 이용하실 수 있습니다.
          </p>

          <div className="mt-4">
            <SetupForm />
          </div>
        </Card>

        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="ghost" className="w-full">
            나중에 하기 (로그아웃)
          </Button>
        </form>
      </div>
    </main>
  );
}
