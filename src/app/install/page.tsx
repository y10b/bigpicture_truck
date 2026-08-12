import Image from "next/image";
import logo from "@/assets/logo.png";
import InstallGuide from "./InstallGuide";

export const metadata = {
  title: "앱 설치 · BIG PICTURE 정산관리",
  description: "휴대폰에 BIG PICTURE 정산 앱을 설치하는 방법",
};

/**
 * 로그인 없이 열리는 설치 안내 페이지.
 * 기사분들께는 이 주소 하나만 보내면 됩니다 — 폰 종류를 알아서 가려 줍니다.
 */
export default function InstallPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-sm rise">
        <div className="mb-6 flex flex-col items-center">
          <Image src={logo} alt="BIG PICTURE" priority className="h-28 w-auto" />
          <p className="-mt-1 text-[13px] font-semibold tracking-wide text-ink-3">
            화물 일일 정산 관리
          </p>
        </div>

        <InstallGuide />

        <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-4">
          아이디는 본인 휴대폰번호입니다.
          <br />
          비밀번호는 관리자에게 받으세요.
        </p>
      </div>
    </main>
  );
}
