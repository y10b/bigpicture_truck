import * as React from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ── Card ─────────────────────────────────────────────── */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink/8 bg-card shadow-[0_1px_2px_rgba(20,22,26,0.04)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  desc,
  right,
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] text-ink-3">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/* ── Button ───────────────────────────────────────────── */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-[0_1px_0_var(--color-brand-700)]",
  dark: "bg-ink text-paper hover:bg-ink-2 active:bg-black",
  outline: "border border-ink/15 bg-card text-ink hover:bg-paper-2",
  ghost: "text-ink-3 hover:bg-ink/5 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-[13px] rounded-lg",
  md: "h-11 px-4 text-[14px] rounded-xl",
  lg: "h-14 px-5 text-[16px] rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 font-semibold transition-colors",
        "disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}

/* ── Input ────────────────────────────────────────────── */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-ink/12 bg-card px-3.5 text-ink",
        "placeholder:text-ink-4 transition-colors",
        "focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-400/15",
        "disabled:bg-paper-2 disabled:text-ink-3",
        className,
      )}
      {...rest}
    />
  );
});

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-ink/12 bg-card px-3.5 py-3 text-ink",
        "placeholder:text-ink-4 transition-colors",
        "focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-400/15",
        className,
      )}
      {...rest}
    />
  );
}

/**
 * 입력 항목 한 칸.
 * `required` 는 빨간 별표, `optional` 은 회색 "선택" 배지를 붙여
 * 꼭 적어야 하는 칸과 건너뛰어도 되는 칸을 한눈에 구분하게 합니다.
 */
export function Field({
  label,
  hint,
  required,
  optional,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1 text-[13px] font-semibold text-ink-2">
          {label}
          {required && (
            <span className="text-danger" aria-label="필수 항목">
              *
            </span>
          )}
          {optional && (
            <span className="rounded px-1 py-px text-[11px] font-bold text-ink-4 ring-1 ring-ink/10">
              선택
            </span>
          )}
        </span>
        {hint && <span className="shrink-0 text-[12px] text-ink-4">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** 폼 맨 위에 두는 "* 표시는 필수 항목입니다" 안내 */
export function RequiredLegend() {
  return (
    <p className="text-[12px] text-ink-4">
      <span className="text-danger">*</span> 표시는 꼭 입력해야 하는 항목입니다.
    </p>
  );
}

/* ── Badge ────────────────────────────────────────────── */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "accent" | "danger";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink/6 text-ink-3",
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-soft text-accent-deep",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────── */
export function Empty({
  icon = "📭",
  title,
  desc,
}: {
  icon?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 text-3xl opacity-70">{icon}</div>
      <p className="text-[14px] font-semibold text-ink-2">{title}</p>
      {desc && <p className="mt-1 text-[13px] text-ink-4">{desc}</p>}
    </div>
  );
}

/* ── Alert ────────────────────────────────────────────── */
export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "brand";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-3.5 py-3 text-[13px] font-medium",
        tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-brand-50 text-brand-600",
      )}
    >
      {children}
    </div>
  );
}
