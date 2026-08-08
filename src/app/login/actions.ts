"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, phoneToEmail } from "@/lib/format";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (phone.length < 10) return { error: "휴대폰번호를 정확히 입력해 주세요." };
  if (!password) return { error: "비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password,
  });

  if (error || !data.user) {
    return { error: "휴대폰번호 또는 비밀번호가 맞지 않습니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "등록되지 않은 계정입니다. 관리자에게 문의해 주세요." };
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    return { error: "비활성 처리된 계정입니다. 관리자에게 문의해 주세요." };
  }

  redirect(profile.role === "admin" ? "/admin" : "/home");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
