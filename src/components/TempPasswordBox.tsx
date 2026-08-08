"use client";

import { useState } from "react";
import { cn } from "@/components/ui";

/**
 * 발급된 임시 비밀번호를 크게 보여주고 복사하게 합니다.
 * 관리자가 이걸 그대로 직원에게 불러주면 되고,
 * 직원은 그 비밀번호로 로그인한 뒤 곧바로 본인 것으로 바꾸게 됩니다.
 */
export default function TempPasswordBox({
  password,
  name,
}: {
  password: string;
  name?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어갑니다 (화면에 이미 보입니다)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-3.5">
      <p className="text-[12px] font-bold text-brand-700">
        {name ? `${name}님의 임시 비밀번호` : "임시 비밀번호"}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <code className="tnum flex-1 rounded-lg bg-card px-3 py-2.5 text-center text-[20px] font-extrabold tracking-[0.12em] text-ink select-all">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "h-11 shrink-0 rounded-lg px-3.5 text-[13px] font-bold transition-colors",
            copied ? "bg-brand-600 text-white" : "bg-ink text-paper active:bg-ink-2",
          )}
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-brand-700/80">
        이 비밀번호를 직원에게 알려주세요. 직원이 로그인하면 <b>본인 비밀번호를
        정하는 화면</b>이 먼저 뜹니다. 이 창을 닫으면 다시 볼 수 없으니 지금
        전달해 주세요.
      </p>
    </div>
  );
}
