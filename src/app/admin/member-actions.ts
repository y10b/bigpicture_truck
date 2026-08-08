"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToEmail } from "@/lib/format";
import { generateTempPassword } from "@/lib/temp-password";

export type MemberState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** 자동 발급한 경우, 관리자가 직원에게 알려줄 임시 비밀번호 */
  tempPassword?: string;
};

/** 직원 계정 생성 — Auth 유저와 profiles 행을 한 번에 만듭니다. */
export async function createMember(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const role = String(formData.get("role") ?? "employee") === "admin" ? "admin" : "employee";
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;

  // 비워두면 임시 비밀번호를 자동으로 만들어 줍니다.
  const typed = String(formData.get("password") ?? "");
  const autoIssued = typed.length === 0;
  const password = autoIssued ? generateTempPassword() : typed;

  if (!name) return { error: "이름을 입력해 주세요." };
  if (phone.length < 10) return { error: "휴대폰번호를 정확히 입력해 주세요." };
  if (!autoIssued && password.length < 6) {
    return { error: "비밀번호는 6자 이상으로 정해 주세요." };
  }

  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (authError || !created.user) {
    const dup = authError?.message?.toLowerCase().includes("already");
    return {
      error: dup
        ? "이미 등록된 휴대폰번호입니다."
        : "계정 생성에 실패했습니다. 다시 시도해 주세요.",
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({
      id: created.user.id,
      name,
      phone,
      role,
      vehicle_no: text("vehicle_no"),
      vehicle_type: text("vehicle_type"),
      bank_account: text("bank_account"),
      memo: text("memo"),
      // 관리자가 정해준 비밀번호이므로 첫 로그인 때 본인이 바꾸게 합니다.
      must_change_password: true,
    });

  if (profileError) {
    // 프로필을 못 만들면 로그인만 가능한 유령 계정이 남으므로 되돌립니다.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "직원 정보 저장에 실패했습니다. 휴대폰번호가 중복인지 확인해 주세요." };
  }

  revalidatePath("/admin/members");
  revalidatePath("/admin");
  return {
    ok: true,
    message: `${name}님 계정을 만들었습니다.`,
    tempPassword: password,
  };
}

/** 계정 활성/비활성 전환 — 비활성이면 로그인이 막힙니다. */
export async function setMemberActive(id: string, active: boolean) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("profiles").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "변경에 실패했습니다." };

  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * 비밀번호 초기화 (직원이 잊어버렸을 때).
 * password 를 비워 보내면 임시 비밀번호를 자동으로 만들어 돌려줍니다.
 * 어느 쪽이든 직원은 다음 로그인 때 본인 비밀번호로 바꾸게 됩니다.
 */
export async function resetMemberPassword(
  id: string,
  password?: string,
): Promise<{ ok: boolean; error?: string; tempPassword?: string }> {
  await requireAdmin();

  const autoIssued = !password;
  const next = password || generateTempPassword();
  if (!autoIssued && next.length < 6) {
    return { ok: false, error: "6자 이상으로 정해 주세요." };
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(id, { password: next });
  if (error) return { ok: false, error: "변경에 실패했습니다." };

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  if (flagError) return { ok: false, error: "상태 저장에 실패했습니다." };

  revalidatePath("/admin/members");
  return { ok: true, tempPassword: next };
}

/** 직원 정보 수정 — 이름 · 휴대폰번호 · 차량번호 · 차종 · 계좌 · 메모 */
export async function updateMember(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const text = (k: string) => String(formData.get(k) ?? "").trim() || null;

  if (!id || !name) return { ok: false, error: "이름을 입력해 주세요." };
  if (phone.length < 10) return { ok: false, error: "휴대폰번호를 정확히 입력해 주세요." };

  const admin = createAdminClient();

  // 번호가 곧 로그인 아이디라, 바뀌면 Auth 쪽 이메일도 같이 옮겨야 합니다.
  const { data: before } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", id)
    .maybeSingle();

  if (before && before.phone !== phone) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email: phoneToEmail(phone),
      email_confirm: true,
    });
    if (authError) {
      return {
        ok: false,
        error: authError.message?.toLowerCase().includes("already")
          ? "이미 등록된 휴대폰번호입니다."
          : "휴대폰번호 변경에 실패했습니다.",
      };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      name,
      phone,
      vehicle_no: text("vehicle_no"),
      vehicle_type: text("vehicle_type"),
      bank_account: text("bank_account"),
      memo: text("memo"),
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: error.code === "23505"
        ? "이미 등록된 휴대폰번호입니다."
        : "수정에 실패했습니다.",
    };
  }

  revalidatePath("/admin/members");
  return { ok: true };
}

/**
 * 권한 변경 — 직원 ↔ 관리자.
 * 본인 권한은 바꿀 수 없고, 마지막 남은 관리자도 내릴 수 없습니다.
 * (아무도 관리자 화면에 못 들어가는 상태가 되면 복구가 번거롭습니다)
 */
export async function setMemberRole(id: string, role: "employee" | "admin") {
  const me = await requireAdmin();
  if (me.id === id) {
    return { ok: false, error: "본인 권한은 바꿀 수 없습니다." };
  }

  const admin = createAdminClient();

  if (role === "employee") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "관리자가 한 명뿐이라 내릴 수 없습니다." };
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) return { ok: false, error: "변경에 실패했습니다." };

  revalidatePath("/admin/members");
  revalidatePath("/admin");
  return { ok: true };
}

/** 계정 완전 삭제 — 정산 내역까지 함께 사라집니다. */
export async function deleteMember(id: string) {
  const me = await requireAdmin();
  if (me.id === id) return { ok: false, error: "본인 계정은 삭제할 수 없습니다." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: "삭제에 실패했습니다." };

  revalidatePath("/admin/members");
  revalidatePath("/admin");
  return { ok: true };
}
