import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoupleRoom = {
  id: string;
  inviteCode: string;
  memberCount: number;
  isOwner: boolean;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode() {
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `SB-${out}`;
}

export function normalizeInviteCode(raw: string) {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("SB") ? cleaned.slice(2) : cleaned;
  return `SB-${body}`;
}

async function loadRoomForUser(userId: string): Promise<CoupleRoom | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: membership } = await supabaseAdmin
    .from("room_members")
    .select("room_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const { data: room } = await supabaseAdmin
    .from("couple_rooms")
    .select("id, invite_code, created_by")
    .eq("id", membership.room_id)
    .maybeSingle();
  if (!room) return null;

  const { count } = await supabaseAdmin
    .from("room_members")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", room.id);

  return {
    id: room.id,
    inviteCode: room.invite_code,
    memberCount: count ?? 1,
    isOwner: room.created_by === userId,
  };
}

/** Returns the couple room the signed-in user belongs to, if any. */
export const getMyRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ room: await loadRoomForUser(context.userId) }));

/** Creates a couple room with a permanent invite code, or returns the existing one. */
export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const existing = await loadRoomForUser(context.userId);
    if (existing) return { room: existing };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomCode();
      const { data: room, error } = await supabaseAdmin
        .from("couple_rooms")
        .insert({ invite_code: code, created_by: context.userId })
        .select("id, invite_code")
        .maybeSingle();
      if (error || !room) continue;

      const { error: memberError } = await supabaseAdmin
        .from("room_members")
        .insert({ room_id: room.id, user_id: context.userId });
      if (memberError) {
        await supabaseAdmin.from("couple_rooms").delete().eq("id", room.id);
        throw new Error("create_failed");
      }

      return {
        room: { id: room.id, inviteCode: room.invite_code, memberCount: 1, isOwner: true },
      };
    }

    throw new Error("create_failed");
  });

export type JoinResult =
  | { ok: true; room: CoupleRoom }
  | { ok: false; reason: "not_found" | "full" | "own_room" | "already_paired" };

/** Joins the couple room that owns the given invite code. */
export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "") }))
  .handler(async ({ data, context }): Promise<JoinResult> => {
    const code = normalizeInviteCode(data.code);
    if (code.length < 5) return { ok: false, reason: "not_found" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room } = await supabaseAdmin
      .from("couple_rooms")
      .select("id, invite_code, created_by")
      .eq("invite_code", code)
      .maybeSingle();
    if (!room) return { ok: false, reason: "not_found" };

    const { data: members } = await supabaseAdmin
      .from("room_members")
      .select("user_id")
      .eq("room_id", room.id);
    const memberIds = (members ?? []).map((m) => m.user_id);

    if (memberIds.includes(context.userId)) {
      return {
        ok: false,
        reason: "own_room",
      };
    }

    const mine = await loadRoomForUser(context.userId);
    if (mine) return { ok: false, reason: "already_paired" };

    if (memberIds.length >= 2) return { ok: false, reason: "full" };

    const { error } = await supabaseAdmin
      .from("room_members")
      .insert({ room_id: room.id, user_id: context.userId });
    if (error) return { ok: false, reason: "full" };

    return {
      ok: true,
      room: {
        id: room.id,
        inviteCode: room.invite_code,
        memberCount: memberIds.length + 1,
        isOwner: room.created_by === context.userId,
      },
    };
  });
