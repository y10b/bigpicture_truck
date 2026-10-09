import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { landingPath } from "@/lib/landing";

/**
 * 앱(과 웹)이 열리면 들어오는 곳.
 * 안 읽은 공지가 있으면 공지로, 없으면 평소 화면으로 보냅니다.
 */
export default async function RootPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(await landingPath(profile));
}
