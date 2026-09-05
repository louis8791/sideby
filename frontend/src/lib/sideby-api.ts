export type SidebyIdentity = {
  token: string;
  role: "A" | "B";
  coupleId: string;
  sessionId: string;
  inviteCode?: string;
};

export type SidebyPublicState = {
  sessionId: string;
  version: number;
  status: "waiting_partner" | "editing" | "ready";
  shared: null | Record<string, unknown>;
  members: Array<{ role: "A" | "B"; online: boolean; confirmed: boolean }>;
};

export type SidebyStop = {
  stop_id: string;
  venue_id: string;
  order_no: number;
  venue_name: string;
  execution_slot_id?: string;
  area_name?: string;
  category: string;
  district: string;
  arrival_at: string;
  leave_at: string;
  travel_minutes: number;
  travel_mode: string;
  estimated_cost: number;
  locked: boolean;
  google_maps_url: string;
  google_place_id?: string;
};

export type SidebyItinerary = {
  itinerary_id: string;
  title: string;
  stops: SidebyStop[];
  total_cost: number;
  total_duration_minutes: number;
  travel_minutes: number;
  couple_score: number;
  public_reason: string;
  data_mode: "approved_dataset" | "synthetic_demo";
};

export class SidebyApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const storageKey = "sideby.formal.v1";

export function loadSidebyIdentity(): SidebyIdentity | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(storageKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as SidebyIdentity;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

export function saveSidebyIdentity(identity: SidebyIdentity) {
  sessionStorage.setItem(storageKey, JSON.stringify(identity));
}

export async function sidebyApi<T>(
  identity: SidebyIdentity | null,
  method: string,
  path: string,
  data?: unknown,
  tokenOverride?: string,
): Promise<T> {
  let response: Response;
  try {
    const request: RequestInit = {
      method,
      headers: {
        ...(tokenOverride ?? identity?.token
          ? { Authorization: `Bearer ${tokenOverride ?? identity?.token}` }
          : {}),
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    };
    response = await fetch(path, request);
  } catch {
    throw new SidebyApiError("NETWORK_UNAVAILABLE");
  }

  let payload: unknown = null;
  try {
    payload = response.status === 204 ? null : await response.json();
  } catch {
    throw new SidebyApiError("INVALID_RESPONSE");
  }
  if (!response.ok) {
    const code = (payload as { error?: { code?: string } })?.error?.code ?? "SERVICE_UNAVAILABLE";
    throw new SidebyApiError(code);
  }
  return payload as T;
}

export async function createSidebyRoom(): Promise<SidebyIdentity> {
  const auth = await sidebyApi<{ token: string }>(null, "POST", "/api/auth/anonymous", {}, "");
  const room = await sidebyApi<{ coupleId: string; role: "A"; inviteCode: string }>(
    null,
    "POST",
    "/api/couples",
    {},
    auth.token,
  );
  const session = await sidebyApi<{ sessionId: string }>(
    null,
    "POST",
    "/api/sessions",
    { coupleId: room.coupleId },
    auth.token,
  );
  return { token: auth.token, role: room.role, coupleId: room.coupleId, sessionId: session.sessionId, inviteCode: room.inviteCode };
}

export async function joinSidebyRoom(inviteCode: string): Promise<SidebyIdentity> {
  const auth = await sidebyApi<{ token: string }>(null, "POST", "/api/auth/anonymous", {}, "");
  const room = await sidebyApi<{ coupleId: string; role: "B" }>(
    null,
    "POST",
    "/api/couples/join",
    { inviteCode },
    auth.token,
  );
  const session = await sidebyApi<{ sessionId: string }>(
    null,
    "POST",
    "/api/sessions",
    { coupleId: room.coupleId },
    auth.token,
  );
  return { token: auth.token, role: room.role, coupleId: room.coupleId, sessionId: session.sessionId };
}
