import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function RootPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/admin" : "/home");
}
