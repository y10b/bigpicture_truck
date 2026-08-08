"use client";

import { useState } from "react";
import { cn } from "@/components/ui";

/**
 * 금액 입력칸. 타이핑하는 동안 자동으로 천단위 콤마가 붙습니다.
 * 서버에서는 숫자만 뽑아 쓰므로 콤마가 섞여도 안전합니다.
 */
export default function MoneyInput({
  name,
  defaultValue,
  placeholder = "0",
  suffix = "원",
  className,
  autoFocus,
  onValueChange,
}: {
  name: string;
  defaultValue?: number;
  placeholder?: string;
  suffix?: string;
  className?: string;
  autoFocus?: boolean;
  /** 검증(버튼 활성화 등)에 쓰라고 숫자값을 그대로 넘겨줍니다 */
  onValueChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(
    defaultValue ? defaultValue.toLocaleString("ko-KR") : "",
  );

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        autoFocus={autoFocus}
        inputMode="numeric"
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          setValue(digits ? Number(digits).toLocaleString("ko-KR") : "");
          onValueChange?.(digits ? Number(digits) : 0);
        }}
        className={cn(
          "tnum h-12 w-full rounded-xl border border-ink/12 bg-card pr-9 pl-3.5 text-right",
          "text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-4",
          "transition-colors focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-400/15",
          className,
        )}
      />
      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[13px] font-medium text-ink-4">
        {suffix}
      </span>
    </div>
  );
}
