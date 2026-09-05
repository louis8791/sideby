// Direct Google web services. Never import this module into browser code.
const PLACES = "https://places.googleapis.com/v1";
const BIAS = { circle: { center: { latitude: 25.0478, longitude: 121.5319 }, radius: 30000 } };
export type Attribution = { displayName: string; uri?: string };
export type PlaceReview = { author: Attribution; rating?: number; relativeTime?: string; text?: string };
export type ReviewSignal = { label: string; count: number; tone: "positive" | "caution" };
export type Venue = {
  query: string; placeId: string; name: string; address: string; lat: number; lng: number;
  rating?: number; ratingCount?: number; openNow?: boolean; category?: string; photoUri?: string;
  openingHours?: string[]; photoAttributions?: Attribution[]; reviews?: PlaceReview[];
  reviewSignals?: ReviewSignal[]; reviewSampleSize?: number; googleMapsUri: string;
};
export type TravelLeg = { from: string; to: string; walkMinutes?: number; transitMinutes?: number; distanceKm?: number };
export type Point = { label: string; lat: number; lng: number };
export type PlaceSuggestion = { placeId: string; name: string; secondary: string };
type Place = {
  id: string; displayName?: { text?: string }; formattedAddress?: string;
  location?: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean }; primaryTypeDisplayName?: { text?: string }; googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name: string; authorAttributions?: Attribution[] }>;
  reviews?: Array<{
    authorAttribution?: Attribution; rating?: number; relativePublishTimeDescription?: string; text?: { text?: string };
  }>;
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
    response = await fetch(target.toString(), { ...init, headers, redirect: "manual" });
  } catch (error) {
    // Fetch errors can contain the key-bearing Geocoding URL. Never forward them.
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Google 連線逾時，請稍後重試");
    }
    const category = error instanceof Error ? error.name : "UnknownError";
    throw new Error(`Google 連線建立失敗（${category}）；請稍後重試`);
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Google 服務回傳未預期的重新導向；已停止請求以保護伺服器金鑰");
  }
  if (!response.ok) throw new Error(`Google 服務拒絕請求（HTTP ${response.status}）；請檢查 API 啟用、帳務、金鑰限制與配額`);
  // Do not read/log provider error bodies, keys or request URLs.
  try { return await response.json() as T; }
  catch { throw new Error("Google 回應格式無法讀取，請稍後重試"); }
}

const FIELDS = ["id", "displayName", "formattedAddress", "location", "rating", "userRatingCount",
  "currentOpeningHours.openNow", "primaryTypeDisplayName", "googleMapsUri"];

const reviewSignalCatalog: Array<{ label: string; tone: ReviewSignal["tone"]; pattern: RegExp }> = [
  { label: "安靜好聊", tone: "positive", pattern: /安靜|清幽|寧靜|不吵|聊天|談心/u },
  { label: "浪漫氣氛", tone: "positive", pattern: /浪漫|約會|情侶|情人|氣氛很好|氛圍很好/u },
  { label: "好拍照", tone: "positive", pattern: /好拍|拍照|打卡|美景|風景很美|夜景|景色很美/u },
  { label: "服務友善", tone: "positive", pattern: /服務很好|服務親切|店員親切|人員親切|友善|熱情招待/u },
  { label: "餐點受好評", tone: "positive", pattern: /好吃|美味|餐點不錯|料理不錯|甜點好吃|咖啡好喝|飲料好喝/u },
  { label: "價格親民", tone: "positive", pattern: /平價|價格合理|價位合理|不貴|划算|物超所值|性價比高/u },
  { label: "交通方便", tone: "positive", pattern: /交通方便|捷運.*方便|離捷運.*近|停車方便|很好找|位置方便/u },
  { label: "環境舒適", tone: "positive", pattern: /環境舒適|空間舒適|很舒服|乾淨整潔|環境乾淨|空間寬敞/u },
  { label: "適合散步", tone: "positive", pattern: /適合散步|散步|步道|走走|逛逛|公園/u },
  { label: "文藝展覽", tone: "positive", pattern: /展覽|藝術|文創|文化|博物館|美術館|設計感/u },
  { label: "親子友善", tone: "positive", pattern: /親子|小孩|兒童|家庭|帶孩子/u },
  { label: "戶外景觀", tone: "positive", pattern: /戶外|露天|露臺|河景|海景|山景|觀景/u },
  { label: "可能擁擠", tone: "caution", pattern: /人很多|人潮|擁擠|客滿|一位難求/u },
  { label: "可能排隊", tone: "caution", pattern: /排隊|候位|等很久|久候/u },
  { label: "價格偏高", tone: "caution", pattern: /價格偏高|價位偏高|價格高|價位高|不便宜|有點貴|很貴/u },
  { label: "停車不易", tone: "caution", pattern: /難停車|停車位少|不好停|停車不便/u },
  { label: "步行較多", tone: "caution", pattern: /走很久|走一段路|爬坡|階梯很多|走到很累/u },
  { label: "可能吵雜", tone: "caution", pattern: /很吵|吵雜|嘈雜|噪音/u },
];

/** Request-local hints for the demo UI. Never persist or use as verified venue facts. */
export function classifyReviewSignals(reviews: PlaceReview[]): ReviewSignal[] {
  const texts = reviews.flatMap(review => review.text?.trim() ? [review.text.normalize("NFKC")] : []);
  return reviewSignalCatalog.map((signal, order) => ({
    ...signal, order, count: texts.filter(text => signal.pattern.test(text)).length,
  })).filter(signal => signal.count > 0)
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, 10)
    .map(({ label, tone, count }) => ({ label, tone, count }));
}

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
  if (place.regularOpeningHours?.weekdayDescriptions?.length) venue.openingHours = place.regularOpeningHours.weekdayDescriptions;
  if (place.primaryTypeDisplayName?.text) venue.category = place.primaryTypeDisplayName.text;
  const reviews = (place.reviews ?? []).flatMap(review => review.authorAttribution ? [{
    author: review.authorAttribution,
    ...(typeof review.rating === "number" ? { rating: review.rating } : {}),
    ...(review.relativePublishTimeDescription ? { relativeTime: review.relativePublishTimeDescription } : {}),
    ...(review.text?.text ? { text: review.text.text } : {}),
  }] : []).slice(0, 5);
  if (reviews.length) {
    venue.reviews = reviews;
    venue.reviewSampleSize = reviews.filter(review => review.text?.trim()).length;
    const signals = classifyReviewSignals(reviews);
    if (signals.length) venue.reviewSignals = signals;
  }
  return venue;
}

async function attachFirstPhoto(venue: Venue, place: Place) {
  const photo = place.photos?.[0];
  if (!photo || !/^places\/[^/]+\/photos\/[^/]+$/.test(photo.name)) return;
  try {
    const media = await googleJson<{ photoUri?: string }>(`${PLACES}/${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`);
    if (media.photoUri?.startsWith("https://")) {
      venue.photoUri = media.photoUri;
      venue.photoAttributions = photo.authorAttributions ?? [];
    }
  } catch { /* Optional photo unavailable; do not fabricate or discard a valid place. */ }
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
  await attachFirstPhoto(venue, place!);
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
    headers: { "X-Goog-FieldMask": [...FIELDS,
      "regularOpeningHours.weekdayDescriptions", "photos.name", "photos.authorAttributions",
      "reviews.authorAttribution", "reviews.rating", "reviews.relativePublishTimeDescription", "reviews.text",
    ].join(",") },
  });
  const venue = toVenue(place, place.displayName?.text ?? "");
  if (!venue) throw new Error("找不到這個地點的座標");
  await attachFirstPhoto(venue, place);
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
