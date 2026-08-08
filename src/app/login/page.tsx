import Image from "next/image";
// 정적 import 라서 파일 내용이 바뀌면 URL 해시도 같이 바뀝니다 (브라우저 캐시가 안 물림)
import logo from "@/assets/logo.png";
import LoginForm from "./LoginForm";

export const metadata = { title: "로그인 · BIG PICTURE 정산관리" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* 로고의 스프레이 얼룩을 배경 글로우로 옮겨온 장식 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm rise">
        <div className="mb-7 flex flex-col items-center">
          <Image src={logo} alt="BIG PICTURE" priority className="h-36 w-auto" />
          <p className="-mt-1 text-[13px] font-semibold tracking-wide text-ink-3">
            화물 일일 정산 관리
          </p>
        </div>

        <LoginForm initialError={error === "inactive" ? "비활성 처리된 계정입니다. 관리자에게 문의해 주세요." : undefined} />

        <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-4">
          계정은 관리자가 만들어 드립니다.
          <br />
          비밀번호를 잊으셨다면 관리자에게 문의해 주세요.
        </p>
      </div>
    </main>
  );
}
