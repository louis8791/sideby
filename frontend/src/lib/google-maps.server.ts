// Direct Google web services. Never import this module into browser code.
const PLACES = "https://places.googleapis.com/v1";
const BIAS = { circle: { center: { latitude: 25.0478, longitude: 121.5319 }, radius: 30000 } };
export type Attribution = { displayName: string; uri?: string };
export type Venue = {
  query: string; placeId: string; name: string; address: string; lat: number; lng: number;
  rating?: number; ratingCount?: number; openNow?: boolean; category?: string; photoUri?: string;
  photoAttributions?: Attribution[]; googleMapsUri: string;
};
export type TravelLeg = { from: string; to: string; walkMinutes?: number; transitMinutes?: number; distanceKm?: number };
export type Point = { label: string; lat: number; lng: number };
export type PlaceSuggestion = { placeId: string; name: string; secondary: string };
type Place = {
  id: string; displayName?: { text?: string }; formattedAddress?: string;
  location?: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean }; primaryTypeDisplayName?: { text?: string }; googleMapsUri?: string;
  photos?: Array<{ name: string; authorAttributions?: Attribution[] }>;
};

export function assertLocalMapsRequest(
  request: Request,
  mode: string | undefined,
  configuredPublicOrigin?: string,
) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (mode === "development") {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Google 開發接線只接受本機網址");
    }
    if (origin !== url.origin) throw new Error("Google 查詢只接受同來源頁面");
    return;
  }

  let publicOrigin: URL;
  try {
    publicOrigin = new URL(configuredPublicOrigin ?? "");
  } catch {
    throw new Error("正式環境尚未設定 SIDEBY_PUBLIC_ORIGIN");
  }
  if (publicOrigin.protocol !== "https:" || publicOrigin.origin !== configuredPublicOrigin) {
    throw new Error("SIDEBY_PUBLIC_ORIGIN 必須是單一 HTTPS Origin，不可包含路徑");
  }
  if (url.origin !== publicOrigin.origin || origin !== publicOrigin.origin) {
    throw new Error("Google 查詢只接受已核准的公開網域");
  }
}

async function googleJson<T>(url: string, init: RequestInit = {}, queryKey = false): Promise<T> {
  const key = process.env["GOOGLE_MAPS_SERVER_API_KEY"]?.trim();
  if (!key) throw new Error("請先在 frontend/.env.local 填入 GOOGLE_MAPS_SERVER_API_KEY，然後重啟前端");
  const target = new URL(url);
  const headers = new Headers(init.headers);
  if (queryKey) target.searchParams.set("key", key);
  else headers.set("X-Goog-Api-Key", key);
  let response: Response;
  try {
    response = await fetch(target, { ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
  } catch {
    // Fetch errors can contain the key-bearing Geocoding URL. Never forward them.
    throw new Error("Google 連線逾時或網路不可用，請稍後重試");
  }
  if (!response.ok) throw new Error(`Google 服務拒絕請求（HTTP ${response.status}）；請檢查 API 啟用、帳務、金鑰限制與配額`);
  // Do not read/log provider error bodies, keys or request URLs.
  try { return await response.json() as T; }
  catch { throw new Error("Google 回應格式無法讀取，請稍後重試"); }
}

const FIELDS = ["id", "displayName", "formattedAddress", "location", "rating", "userRatingCount",
  "currentOpeningHours.openNow", "primaryTypeDisplayName", "googleMapsUri"];
function toVenue(place: Place, query: string): Venue | null {
  if (!place.location || !place.id) return null;
  const venue: Venue = {
    query, placeId: place.id, name: place.displayName?.text ?? query, address: place.formattedAddress ?? "",
    lat: place.location.latitude, lng: place.location.longitude,
    googleMapsUri: place.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(place.id)}`,
  };
  if (typeof place.rating === "number") venue.rating = place.rating;
  if (typeof place.userRatingCount === "number") venue.ratingCount = place.userRatingCount;
  if (typeof place.currentOpeningHours?.openNow === "boolean") venue.openNow = place.currentOpeningHours.openNow;
  if (place.primaryTypeDisplayName?.text) venue.category = place.primaryTypeDisplayName.text;
  return venue;
}

export async function searchVenue(query: string): Promise<Venue | null> {
  const payload = await googleJson<{ places?: Place[] }>(`${PLACES}/places:searchText`, {
    method: "POST", headers: { "Content-Type": "application/json",
      "X-Goog-FieldMask": [...FIELDS, "photos.name", "photos.authorAttributions"].map(f => `places.${f}`).join(",") },
    body: JSON.stringify({ textQuery: query, languageCode: "zh-TW", regionCode: "TW", pageSize: 1, locationBias: BIAS }),
  });
  const place = payload.places?.[0];
  const venue = place ? toVenue(place, query) : null;
  if (!venue) return null;
  const photo = place?.photos?.[0];
  if (photo && /^places\/[^/]+\/photos\/[^/]+$/.test(photo.name)) {
    try {
      const media = await googleJson<{ photoUri?: string }>(`${PLACES}/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`);
      if (media.photoUri?.startsWith("https://")) {
        venue.photoUri = media.photoUri;
        venue.photoAttributions = photo.authorAttributions ?? [];
      }
    } catch { /* Optional photo unavailable; do not fabricate or discard a valid place. */ }
  }
  return venue;
}

export async function resolveVenueQueries(queries: string[]) {
  // Request-local deduplication only. No global Places/photo cache or database storage.
  const venues: Venue[] = [];
  for (const query of new Set(queries)) { const venue = await searchVenue(query); if (venue) venues.push(venue); }
  return { venues };
}

export async function autocomplete(input: string): Promise<{ suggestions: PlaceSuggestion[] }> {
  const payload = await googleJson<{ suggestions?: Array<{ placePrediction?: {
    placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string };
  } }> }>(`${PLACES}/places:autocomplete`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, languageCode: "zh-TW", regionCode: "TW", includedRegionCodes: ["tw"], locationBias: BIAS }),
  });
  return { suggestions: (payload.suggestions ?? []).flatMap(({ placePrediction: p }) => p?.placeId ? [{
    placeId: p.placeId, name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "", secondary: p.structuredFormat?.secondaryText?.text ?? "",
  }] : []).slice(0, 6) };
}

export async function placeDetails(placeId: string) {
  const place = await googleJson<Place>(`${PLACES}/places/${encodeURIComponent(placeId)}?languageCode=zh-TW&regionCode=TW`, {
    headers: { "X-Goog-FieldMask": FIELDS.join(",") },
  });
  const venue = toVenue(place, place.displayName?.text ?? "");
  if (!venue) throw new Error("找不到這個地點的座標");
  return { venue };
}

export async function computeLeg(origin: Point, destination: Point, travelMode: "WALK" | "TRANSIT") {
  const location = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const payload = await googleJson<{ routes?: Array<{ duration?: string; distanceMeters?: number }> }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      body: JSON.stringify({ origin: location(origin), destination: location(destination), travelMode, languageCode: "zh-TW", regionCode: "TW" }),
    });
  const route = payload.routes?.[0];
  const seconds = route?.duration && /^\d+(\.\d+)?s$/.test(route.duration) ? Number(route.duration.slice(0, -1)) : NaN;
  return {
    minutes: Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : undefined,
    distanceKm: typeof route?.distanceMeters === "number" ? Math.round(route.distanceMeters / 100) / 10 : undefined,
  };
}

export async function travelLegs(points: Point[]) {
  const legs: TravelLeg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!; const to = points[i + 1]!;
    const [walk, transit] = await Promise.all([computeLeg(from, to, "WALK"), computeLeg(from, to, "TRANSIT")]);
    const leg: TravelLeg = { from: from.label, to: to.label };
    if (walk.minutes !== undefined) leg.walkMinutes = walk.minutes;
    if (transit.minutes !== undefined) leg.transitMinutes = transit.minutes;
    const distance = walk.distanceKm ?? transit.distanceKm;
    if (distance !== undefined) leg.distanceKm = distance;
    legs.push(leg);
  }
  return { legs };
}

export async function geocode(address: string) {
  const params = new URLSearchParams({ address, language: "zh-TW", region: "tw", components: "country:TW" });
  const payload = await googleJson<{ status: string; results?: Array<{
    formatted_address: string; place_id: string; geometry: { location: { lat: number; lng: number }; location_type: string }; partial_match?: boolean;
  }> }>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {}, true);
  if (payload.status === "ZERO_RESULTS") return { location: null };
  if (payload.status !== "OK") throw new Error("Google 地址定位不可用；請檢查 Geocoding API、帳務、金鑰限制與配額");
  const result = payload.results?.[0];
  if (!result?.geometry?.location) return { location: null };
  // Address coordinates are not verified businesses or recommendation candidates.
  return { location: { address: result.formatted_address, placeId: result.place_id, ...result.geometry.location,
    precision: result.geometry.location_type, partialMatch: result.partial_match ?? false } };
}
