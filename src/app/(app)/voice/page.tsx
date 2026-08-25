import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import VoiceComposer from "./VoiceComposer";
import VoiceInbox, { type InboxItem } from "./VoiceInbox";
import MyVoiceList, { type MyVoice } from "./MyVoiceList";

export const metadata = { title: "사장님께 · BIG PICTURE" };

export default async function VoicePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // 읽을 권한이 있는 사람에게만 받은 목록이 채워집니다.
  // (함수 안에서 검사하므로 여기서 따로 거르지 않아도 남의 글이 오지 않습니다)
  const [{ data: inboxData }, { data: mineData }] = await Promise.all([
    supabase.rpc("voice_inbox"),
    supabase
      .from("voice_messages")
      .select("id, body, anonymous, reply, replied_at, read_at, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const inbox = (inboxData ?? []) as InboxItem[];
  const mine = (mineData ?? []) as MyVoice[];
  const canRead = profile.can_read_voice;

  return (
    <div className="space-y-4 rise">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight">사장님께</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          {canRead
            ? "직원분들이 보낸 이야기입니다. 익명으로 온 글은 누가 썼는지 알 수 없습니다."
            : "일하면서 힘든 점, 고쳤으면 하는 것을 편하게 적어 주세요."}
        </p>
      </div>

      {/* 읽는 사람에게는 받은 이야기가 먼저입니다 */}
      {canRead && <VoiceInbox items={inbox} />}

      {!canRead && (
        <Card className="border-brand-200 bg-brand-50/60 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            여기에 쓴 내용은 <b className="text-brand-700">사장님</b>만 봅니다.
            같이 일하는 다른 사람은 볼 수 없습니다.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-4">
            이름을 밝히지 않고 보내면 누가 썼는지 사장님께도 보이지 않습니다.
          </p>
        </Card>
      )}

      <VoiceComposer canRead={canRead} />

      <MyVoiceList items={mine} />
    </div>
  );
}
