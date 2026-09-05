import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Footprints,
  Heart,
  Lock,
  MapPin,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  Share2,
  Sparkles,
  Star,
  TrainFront,
  Users,
  X,
  CalendarDays,

} from "lucide-react";
import { AuthSheet } from "@/components/AuthSheet";
import { DateMap, type MapStop } from "@/components/DateMap";
import { DateSheet, TimeSheet, formatDateLabel } from "@/components/DateSheet";
import { PlaceField } from "@/components/PlaceField";
import { GoogleAttribution } from "@/components/GoogleAttribution";

import { useSession } from "@/lib/use-session";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { computeTravelLegs, getPlaceDetails, type TravelLeg, type Venue } from "@/lib/maps.functions";
import { analyzePreferenceInput } from "@/lib/preferences.functions";
import type { PreferenceProfile } from "@/lib/preference-types";
import { trustedGooglePlaceIds } from "@/lib/venue-enrichment-policy";
import {
  createSidebyRoom,
  joinSidebyRoom,
  loadSidebyIdentity,
  saveSidebyIdentity,
  sidebyApi,
  SidebyApiError,
  type SidebyIdentity,
  type SidebyItinerary,
  type SidebyPublicState,
} from "@/lib/sideby-api";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SideBy｜兩個人的約會共決策" },
      {
        name: "description",
        content:
          "不必為了「去哪裡」來回討論。說出你們想要的感覺，讓 AI 把兩個人的想法排成一條今晚剛剛好的路線。",
      },
      { property: "og:title", content: "SideBy｜兩個人的約會共決策" },
      {
        property: "og:description",
        content: "建立雙人房間、分別輸入感受，AI 產出 3 種完整約會路線。",
      },
    ],
  }),
  component: Home,
});

type Screen = "room" | "shared" | "private" | "plans" | "final";
type Stop = {
  backendStopId?: string;
  backendVenueId?: string;
  time: string;
  name: string;
  type: string;
  meta: string;
  color: string;
  query: string;
  locked?: boolean;
  mapsUrl?: string;
  googlePlaceId?: string;
  travelMinutes?: number;
};
type Plan = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  score: number;
  total: string;
  movement: string;
  durationMinutes?: number;
  stops: Stop[];
  reason: string;
  dataMode?: "approved_dataset" | "synthetic_demo";
};
type PreferenceFeedbackSignal = "too_dark" | "too_noisy" | "too_childish" | "too_formal" | "too_much_walking";

const planColors = ["mint", "lilac", "yellow"];
const stopColors = ["yellow", "mint", "lilac", "peach"];
const preferenceFeedbackOptions: Array<{ signal: PreferenceFeedbackSignal; label: string }> = [
  { signal: "too_dark", label: "太暗" },
  { signal: "too_noisy", label: "太吵" },
  { signal: "too_childish", label: "太幼稚" },
  { signal: "too_formal", label: "太正式" },
  { signal: "too_much_walking", label: "走太多" },
];

function clock(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function fromSidebyItinerary(itinerary: SidebyItinerary, index: number): Plan {
  return {
    id: itinerary.itinerary_id,
    title: itinerary.title,
    subtitle: itinerary.public_reason,
    color: planColors[index % planColors.length]!,
    score: Math.round(itinerary.couple_score * 100),
    total: `NT$ ${itinerary.total_cost.toLocaleString("zh-TW")}`,
    movement: `移動 ${itinerary.travel_minutes} 分鐘`,
    stops: itinerary.stops.map((stop, stopIndex) => ({
      backendStopId: stop.stop_id,
      backendVenueId: stop.venue_id,
      time: clock(stop.arrival_at),
      name: stop.venue_name,
      type: stop.category,
      meta: `${Math.max(1, Math.round((new Date(stop.leave_at).getTime() - new Date(stop.arrival_at).getTime()) / 60000))} 分鐘 · NT$${stop.estimated_cost}${stop.area_name ? ` · ${stop.area_name}` : ""}`,
      color: stopColors[stopIndex % stopColors.length]!,
      query: stop.venue_name,
      locked: stop.locked,
      mapsUrl: stop.google_maps_url,
      ...(stop.google_place_id ? { googlePlaceId: stop.google_place_id } : {}),
      travelMinutes: stop.travel_minutes,
    })),
    reason: itinerary.public_reason,
    dataMode: itinerary.data_mode,
    durationMinutes: itinerary.total_duration_minutes,
  };
}

function durationLabel(minutes: number | undefined) {
  if (!minutes) return "尚未計算";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours} 小時` : ""}${hours && rest ? " " : ""}${rest ? `${rest} 分` : ""}`;
}

const backendErrors: Record<string, string> = {
  INVITE_UNAVAILABLE: "邀請碼不存在或已過期。",
  ROOM_FULL: "這個房間已經有兩個人。",
  VERSION_CONFLICT: "另一半剛更新內容，已重新同步，請再試一次。",
  PARTNER_REQUIRED: "需要另一半加入後才能繼續。",
  SHARED_REQUIRED: "請先儲存共同條件。",
  TERMS_REQUIRED: "請先接受本版服務條款。",
  PERSONALIZATION_REQUIRED: "行程已定案；請先開啟個人化，才能將回饋用於未來約會。",
  DECISION_IN_PROGRESS: "你們已開始喜歡、鎖定或選擇方案；為避免清掉共同決策，這次不會重新產生。",
  PRIVATE_INPUT_UNRESOLVED: "需求還不夠明確，請換一種說法。",
  SESSION_NOT_READY: "兩人都要完成私密需求並確認最新版。",
  NO_FEASIBLE_ITINERARIES: "目前條件找不到三套安全可行行程。",
  RECOMMENDATION_DATA_UNAVAILABLE: "目前沒有可用且版本一致的推薦資料。",
  NETWORK_UNAVAILABLE: "目前連不上 Sideby，沒有顯示假成功。",
};

const INITIAL_PLANS: Plan[] = [
  {
    id: "A",
    title: "明亮慢步調",
    subtitle: "咖啡香 × 城市散步",
    color: "mint",
    score: 92,
    total: "NT$ 1,850",
    movement: "捷運＋步行 31 分鐘",
    stops: [
      {
        time: "18:00",
        name: "中山站 4 號出口",
        type: "集合",
        meta: "相約碰面",
        color: "yellow",
        query: "捷運中山站 台北",
      },
      {
        time: "18:10",
        name: "Fika Fika Cafe",
        type: "咖啡廳",
        meta: "65 分鐘 · NT$520",
        color: "mint",
        query: "Fika Fika Cafe 伊通街 台北",
      },
      {
        time: "19:30",
        name: "台北當代藝術館",
        type: "展覽",
        meta: "70 分鐘 · NT$600",
        color: "lilac",
        query: "台北當代藝術館",
      },
      {
        time: "21:00",
        name: "欣葉台菜 雙城店",
        type: "晚餐",
        meta: "50 分鐘 · NT$730",
        color: "peach",
        query: "欣葉台菜 雙城店 台北",
      },
    ],
    reason: "把舒適、互動感與低移動距離放在同一條路線裡。",
  },
  {
    id: "B",
    title: "可愛互動感",
    subtitle: "一起做點只屬於你們的事",
    color: "lilac",
    score: 88,
    total: "NT$ 2,080",
    movement: "捷運＋步行 24 分鐘",
    stops: [
      {
        time: "18:00",
        name: "中山站 4 號出口",
        type: "集合",
        meta: "相約碰面",
        color: "yellow",
        query: "捷運中山站 台北",
      },
      {
        time: "18:20",
        name: "日星鑄字行",
        type: "雙人手作",
        meta: "90 分鐘 · NT$1,000",
        color: "lilac",
        query: "日星鑄字行 台北",
      },
      {
        time: "20:05",
        name: "Miss V Bakery",
        type: "甜點",
        meta: "45 分鐘 · NT$480",
        color: "mint",
        query: "Miss V Bakery 赤峰街 台北",
      },
      {
        time: "21:00",
        name: "赤峰街",
        type: "散步",
        meta: "40 分鐘 · NT$600",
        color: "peach",
        query: "赤峰街 大同區 台北",
      },
    ],
    reason: "用一段共同完成的體驗，讓今晚多一點新鮮感與笑聲。",
  },
  {
    id: "C",
    title: "低移動放鬆型",
    subtitle: "少一點奔波，多一點陪伴",
    color: "yellow",
    score: 86,
    total: "NT$ 1,560",
    movement: "步行為主 12 分鐘",
    stops: [
      {
        time: "18:00",
        name: "中山站 4 號出口",
        type: "集合",
        meta: "相約碰面",
        color: "yellow",
        query: "捷運中山站 台北",
      },
      {
        time: "18:15",
        name: "Coffee Stand by me",
        type: "咖啡廳",
        meta: "80 分鐘 · NT$560",
        color: "mint",
        query: "Coffee Stand by me 赤峰街 台北",
      },
      {
        time: "19:45",
        name: "花博公園圓山園區",
        type: "公園散步",
        meta: "35 分鐘 · 免費",
        color: "lilac",
        query: "花博公園圓山園區 台北",
      },
      {
        time: "20:30",
        name: "雙連圓仔湯",
        type: "晚餐",
        meta: "55 分鐘 · NT$1,000",
        color: "peach",
        query: "雙連圓仔湯 台北",
      },
    ],
    reason: "保留一點空白與舒服的節奏，適合今天不想趕行程的你們。",
  },
];

const PREF_CATEGORIES: { key: string; title: string; initial: number; options: string[] }[] = [
  {
    key: "vibe",
    title: "今天想要的氛圍",
    initial: 6,
    options: [
      "浪漫",
      "放鬆",
      "安靜",
      "有趣",
      "有質感",
      "療癒",
      "有儀式感",
      "新鮮感",
      "熱鬧",
      "私密感",
      "輕鬆隨性",
      "特別一點",
    ],
  },
  {
    key: "state",
    title: "今天的狀態",
    initial: 6,
    options: [
      "有點累",
      "精神很好",
      "不想動腦",
      "想聊天",
      "想放空",
      "想走走",
      "想做點事情",
      "想被照顧",
    ],
  },
  {
    key: "action",
    title: "想要的互動",
    initial: 6,
    options: [
      "好好聊天",
      "一起體驗",
      "一起吃東西",
      "散步",
      "看展 / 看表演",
      "一起拍照",
      "動手做東西",
      "找新店",
      "小酌",
      "看夜景",
    ],
  },
];

const VISIBILITY_OPTIONS = [
  { value: "private_session", label: "只限本次", desc: "這次配對結束後不作為長期偏好" },
  { value: "private_remembered", label: "讓 AI 之後也記得", desc: "之後推薦時可以參考" },
];


function FlowHeader({
  kicker,
  title,
  desc,
}: {
  kicker: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="flow-header">
      <span className="eyebrow">{kicker}</span>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}


function VenueDetails({ venue }: { venue: Venue }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venue.name,
  )}&query_place_id=${venue.placeId}`;
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    venue.name,
  )}&destination_place_id=${venue.placeId}&travelmode=transit`;

  return (
    <div className="venue-block">
      {venue.photoUri && (
        <figure>
          <img className="venue-photo" src={venue.photoUri} alt={`${venue.name} 實景照片`} loading="lazy" />
          <figcaption>{venue.photoAttributions?.map((author, index) => (
            <span key={index}>{index > 0 && " · "}{author.uri && /^(https:\/\/|\/\/)/.test(author.uri)
              ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a>
              : author.displayName}</span>
          ))}</figcaption>
        </figure>
      )}
      <div className="venue-meta">
        <span className="venue-name">{venue.name}</span>
        {venue.category && <span className="venue-tag">{venue.category}</span>}
        {typeof venue.rating === "number" && (
          <span className="venue-tag">
            <Star size={12} fill="currentColor" /> {venue.rating.toFixed(1)}
            {venue.ratingCount ? `（${venue.ratingCount}）` : ""}
          </span>
        )}
        {typeof venue.openNow === "boolean" && (
          <span className={`venue-tag ${venue.openNow ? "open" : "closed"}`}>
            <Clock size={12} /> {venue.openNow ? "營業中" : "目前休息"}
          </span>
        )}
      </div>
      {venue.address && <p className="venue-address">{venue.address}</p>}
      {venue.openingHours?.length && (
        <details className="venue-live-details">
          <summary>查看本週營業時間</summary>
          <ul>{venue.openingHours.map(line => <li key={line}>{line}</li>)}</ul>
        </details>
      )}
      {venue.reviewSignals?.length && (
        <div className="review-signals">
          <div className="review-signals-title">
            <strong>評論情境線索</strong>
            <span>依目前 {venue.reviewSampleSize ?? venue.reviews?.length ?? 0} 則文字評論粗略歸類</span>
          </div>
          <div className="review-signal-list">
            {venue.reviewSignals.map(signal => (
              <span key={signal.label} className={`review-signal ${signal.tone}`}>
                {signal.label}{signal.count > 1 ? ` ×${signal.count}` : ""}
              </span>
            ))}
          </div>
          <small>僅供模擬比較，不是 Sideby 核准事實，也不影響價格、冷氣或室內外硬篩選。</small>
        </div>
      )}
      {venue.reviews?.length && (
        <div className="venue-reviews">
          <strong>Google 最新評論</strong>
          {venue.reviews.map((review, index) => (
            <blockquote key={`${review.author.displayName}-${index}`}>
              <p>{review.text ?? "此評論沒有文字內容"}</p>
              <footer>
                {review.author.uri ? <a href={review.author.uri} target="_blank" rel="noreferrer">{review.author.displayName}</a>
                  : review.author.displayName}
                {typeof review.rating === "number" ? ` · ${review.rating.toFixed(1)} 分` : ""}
                {review.relativeTime ? ` · ${review.relativeTime}` : ""}
              </footer>
            </blockquote>
          ))}
        </div>
      )}
      <GoogleAttribution />
      <div className="venue-actions">
        <a className="venue-btn" href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin size={14} /> 在 Google 地圖開啟
        </a>
        <a className="venue-btn nav" href={navUrl} target="_blank" rel="noreferrer">
          <Navigation size={14} /> 開始導航
        </a>
      </div>
    </div>
  );
}

function TravelChips({ leg }: { leg: TravelLeg | undefined }) {
  if (!leg) return <div className="travel-line"><span>正在計算交通時間…</span></div>;
  return (
    <div className="travel-line">
      {leg.walkMinutes && (
        <span>
          <Footprints size={13} /> 步行 {leg.walkMinutes} 分鐘
        </span>
      )}
      {leg.transitMinutes && (
        <span>
          <TrainFront size={13} /> 捷運 {leg.transitMinutes} 分鐘
        </span>
      )}
      {leg.distanceKm && (
        <span>
          <RouteIcon size={13} /> 距離 {leg.distanceKm} km
        </span>
      )}
    </div>
  );
}

function Home() {

  const { user } = useSession();
  const [authAvailable, setAuthAvailable] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("room");
  const [identity, setIdentity] = useState<SidebyIdentity | null>(null);
  const [publicState, setPublicState] = useState<SidebyPublicState | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [savingShared, setSavingShared] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<"standard" | "synthetic_demo" | "unavailable">("unavailable");

  useEffect(() => {
    setIdentity(loadSidebyIdentity());
    setAuthAvailable(isSupabaseConfigured());
  }, []);
  useEffect(() => {
    void sidebyApi<{ mode: "standard" | "synthetic_demo" }>(null, "GET", "/api/runtime")
      .then((value) => setRuntimeMode(value.mode))
      .catch(() => setRuntimeMode("unavailable"));
  }, []);

  const room = identity
    ? { inviteCode: identity.inviteCode ?? "", memberCount: publicState?.members.length ?? 1 }
    : null;
  const role = identity?.role ?? "A";


  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }, []);
  const [dateISO, setDateISO] = useState(todayISO);
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("18:00");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePicker, setTimePicker] = useState<"start" | "end" | null>(null);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [location, setLocation] = useState("");
  const [meetPlace, setMeetPlace] = useState<Venue | null>(null);
  const date = formatDateLabel(dateISO);
  const time = `${startTime} — ${endTime}`;

  const [budget, setBudget] = useState("2200");
  const [mode, setMode] = useState<"now" | "future">("now");
  const [transport, setTransport] = useState<string[]>(["步行", "捷運"]);

  const [visibility, setVisibility] = useState("private_session");
  const [moods, setMoods] = useState<string[]>(["放鬆"]);
  const [setting, setSetting] = useState<"indoor" | "outdoor" | null>(null);
  const [airConditioning, setAirConditioning] = useState<"required" | "excluded" | null>(null);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [hardNo, setHardNo] = useState("");
  const [externalAiConsent, setExternalAiConsent] = useState(false);
  const [modelImprovementOptIn, setModelImprovementOptIn] = useState(false);
  const [consentsReady, setConsentsReady] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setConsentsReady(false);
    if (!identity) return;
    void sidebyApi<{ modelImprovementOptIn: boolean; personalizationEnabled: boolean }>(identity, 'GET', '/api/me/consents').then(value => {
      if (!cancelled) {
        setModelImprovementOptIn(value.modelImprovementOptIn);
        setPersonalizationEnabled(value.personalizationEnabled);
        setConsentsReady(true);
      }
    }).catch(() => { if (!cancelled) toast.error('無法讀取資料使用設定，請稍後再試。'); });
    return () => { cancelled = true; };
  }, [identity]);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile | null>(null);
  const runPreferenceAnalysis = useServerFn(analyzePreferenceInput);


  const [selectedPlanId, setSelectedPlanId] = useState("A");
  const [lockedStops, setLockedStops] = useState<string[]>([]);
  const [learnedStops, setLearnedStops] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [plansReady, setPlansReady] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [finalized, setFinalized] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"idle" | "saving" | "pending_partner" | "choice_conflict" | "finalized">("idle");

  const refreshSideby = useCallback(async () => {
    if (!identity) return;
    const [nextState, result] = await Promise.all([
      sidebyApi<SidebyPublicState>(identity, "GET", `/api/sessions/${identity.sessionId}`),
      sidebyApi<{ itineraries: SidebyItinerary[]; finalizedItineraryId: string | null }>(
        identity,
        "GET",
        `/api/sessions/${identity.sessionId}/itineraries`,
      ),
    ]);
    setPublicState(nextState);
    setPartnerJoined(nextState.members.length >= 2);
    if (result.itineraries.length) {
      const nextPlans = result.itineraries.map(fromSidebyItinerary);
      setPlans(nextPlans);
      setPlansReady(true);
      setLockedStops(nextPlans.flatMap((plan) => plan.stops.filter((stop) => stop.locked).map((stop) => stop.name)));
      setSelectedPlanId((current) => nextPlans.some((plan) => plan.id === current) ? current : nextPlans[0]!.id);
    }
    setFinalized(Boolean(result.finalizedItineraryId));
  }, [identity]);

  useEffect(() => {
    if (!identity) return;
    setRoomLoading(true);
    void refreshSideby().catch(() => toast.error("Sideby 後端暫時無法同步。"))
      .finally(() => setRoomLoading(false));
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSideby().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [identity, refreshSideby]);

  const currentPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0]!,
    [plans, selectedPlanId],
  );
  const planLabel = (id: string) => String.fromCharCode(65 + Math.max(0, plans.findIndex((plan) => plan.id === id)));

  // ---- Real Google Places / Routes data for the selected itinerary ----
  const lookupPlaceDetails = useServerFn(getPlaceDetails);
  const lookupLegs = useServerFn(computeTravelLegs);
  const [venues, setVenues] = useState<Record<string, Venue>>({});
  const [legs, setLegs] = useState<TravelLeg[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [originLabel, setOriginLabel] = useState("現在位置");
  const [mapsError, setMapsError] = useState(false);

  const askLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("現在位置");
      },
      () => {
        // Permission denied → fall back to the meeting point the couple chose.
        setOrigin(null);
        setOriginLabel(location);
      },
      { timeout: 8000 },
    );
  }, [location]);

  const stopPlaceIds = useMemo(
    () => trustedGooglePlaceIds(currentPlan.stops),
    [currentPlan],
  );

  useEffect(() => {
    if (!plansReady || (screen !== "final" && screen !== "plans")) return;
    if (stopPlaceIds.length === 0) {
      setVenues({});
      setMapsError(false);
      return;
    }
    let cancelled = false;
    Promise.all(stopPlaceIds.map((placeId) => lookupPlaceDetails({ data: { placeId } })))
      .then((results) => {
        if (cancelled) return;
        setVenues(Object.fromEntries(results.map(({ venue }) => [venue.placeId, venue])));
      })
      .catch(() => {
        if (!cancelled) setMapsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [screen, stopPlaceIds, lookupPlaceDetails, plansReady]);

  const mapStops = useMemo<MapStop[]>(() => {
    const list: MapStop[] = [];
    if (origin)       list.push({
        label: originLabel,
        lat: origin.lat,
        lng: origin.lng,
        color: "yellow",
        order: "◎",
        isOrigin: true,
      });
    currentPlan.stops.forEach((stop, index) => {
      const venue = stop.googlePlaceId ? venues[stop.googlePlaceId] : undefined;
      if (venue)
        list.push({
          label: venue.name,
          lat: venue.lat,
          lng: venue.lng,
          color: stop.color,
          order: index === 0 ? "◎" : String(index),
        });
    });
    return list;
  }, [currentPlan, venues, origin, originLabel]);

  useEffect(() => {
    if (screen !== "final" || mapStops.length < 2) return;
    let cancelled = false;
    lookupLegs({
      data: { points: mapStops.map((s) => ({ label: s.label, lat: s.lat, lng: s.lng })) },
    })
      .then((res) => {
        if (!cancelled) setLegs(res.legs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screen, mapStops, lookupLegs]);

  useEffect(() => {
    if (screen === "final") askLocation();
  }, [screen, askLocation]);

  const legFor = (index: number) => legs[origin ? index + 1 : index];

  const go = (next: Screen) => setScreen(next);

  const draftDirty = location.trim().length > 0 || meetPlace !== null;
  const requestLeave = () => {
    if (draftDirty) {
      setLeaveAsk(true);
      return;
    }
    go("room");
  };



  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const next = await createSidebyRoom();
      saveSidebyIdentity(next);
      setIdentity(next);
      setPlansReady(false);
      toast.success("空間已建立，把邀請碼傳給另一半吧");
    } catch (error) {
      const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
      toast.error(backendErrors[code] ?? "建立空間時發生問題，請再試一次");
    } finally {
      setCreating(false);
    }
  };

  const copyInvite = async () => {
    if (!room?.inviteCode) return;
    await navigator.clipboard?.writeText(room.inviteCode).catch(() => null);
    toast.success("邀請碼已複製");
  };

  const handleJoinRoom = async () => {
    if (joinCode.trim().length === 0) return;
    setJoining(true);
    try {
      const next = await joinSidebyRoom(joinCode.trim());
      saveSidebyIdentity(next);
      setIdentity(next);
      setPlansReady(false);
      setJoinCode("");
      toast.success("已加入你們共同的 SideBy 空間");
    } catch (error) {
      const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
      toast.error(backendErrors[code] ?? "加入時發生問題，請再試一次");
    } finally {
      setJoining(false);
    }
  };

  const saveSharedConditions = async () => {
    if (!identity || !publicState) {
      toast.error("請先建立或加入共同空間。");
      return;
    }
    if (!meetPlace) {
      toast.error("請從搜尋結果選擇集合地點。");
      return;
    }
    setSavingShared(true);
    try {
      const transportMap: Record<string, "walk" | "transit" | "car" | "bike"> = {
        步行: "walk", 捷運: "transit", 機車: "bike", 汽車: "car",
      };
      await sidebyApi(identity, "PUT", `/api/sessions/${identity.sessionId}/shared`, {
        version: publicState.version,
        shared: {
          mode,
          startsAt: `${dateISO}T${startTime}:00+08:00`,
          endsAt: `${dateISO}T${endTime}:00+08:00`,
          meetingPoint: {
            label: meetPlace.name,
            latitude: meetPlace.lat,
            longitude: meetPlace.lng,
            matrixKey: runtimeMode === "synthetic_demo" ? "meeting_test" : "meeting_user",
          },
          budgetTwdTotal: Number(budget),
          transport: transport.map((item) => transportMap[item]).filter(Boolean),
          stops: 3,
          outdoorAllowed: true,
          bookingAllowed: false,
        },
      });
      await refreshSideby();
      toast.success("共同條件已同步給另一半。");
      go("private");
    } catch (error) {
      const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
      toast.error(backendErrors[code] ?? `共同條件無法儲存（${code}）。`);
    } finally {
      setSavingShared(false);
    }
  };


  const confirmAndGenerate = async () => {
    if (!identity) return false;
    const latest = await sidebyApi<SidebyPublicState>(identity, "GET", `/api/sessions/${identity.sessionId}`);
    const confirmed = await sidebyApi<SidebyPublicState>(
      identity,
      "POST",
      `/api/sessions/${identity.sessionId}/confirm`,
      { version: latest.version },
    );
    setPublicState(confirmed);
    if (confirmed.status !== "ready") {
      toast.success("你的需求已安全保存，等待另一半完成並確認最新版。");
      return false;
    }
    const result = await sidebyApi<{ itineraries: SidebyItinerary[] }>(
      identity,
      "POST",
      `/api/sessions/${identity.sessionId}/generate`,
      { version: confirmed.version },
    );
    const nextPlans = result.itineraries.map(fromSidebyItinerary);
    setPlans(nextPlans);
    setPlansReady(true);
    setLockedStops(nextPlans.flatMap((plan) => plan.stops.filter((stop) => stop.locked).map((stop) => stop.name)));
    setSelectedPlanId(nextPlans[0]!.id);
    toast.success("兩人的條件已確認，完成三套配對方案。");
    return true;
  };

  const submitPrivate = async () => {
    if (!identity) {
      toast.error("請先建立或加入共同空間。");
      return;
    }
    setGenerating(true);
    setAiError(false);
    try {
      if (externalAiConsent) {
        try {
          const result = await runPreferenceAnalysis({
            data: { moods, freeText: rawText, hardNo, visibility },
          });
          setPreferenceProfile(result.profile);
        } catch {
          setPreferenceProfile(null);
          toast.info("Gemini 暫時不可用，改用本機安全規則解析。");
        }
      } else {
        setPreferenceProfile(null);
        toast.info("未授權外部 AI，本次只使用本機安全規則解析。");
      }
      if (!consentsReady || savingConsent) throw new SidebyApiError('NETWORK_UNAVAILABLE');
      const remembered = visibility === "private_remembered";
      await sidebyApi(identity, "PUT", "/api/me/consents", {
        termsVersion: "2026-09-05-v1",
        acceptTerms: true,
        personalizationEnabled: remembered,
        modelImprovementOptIn,
      });
      setPersonalizationEnabled(remembered);
      const environmentLabels = [
        setting === "indoor" ? "室內" : setting === "outdoor" ? "戶外（含戶外區）" : "",
        airConditioning === "required" ? "冷氣" : airConditioning === "excluded" ? "無冷氣" : "",
      ].filter(Boolean);
      const privateText = [
        rawText.trim(),
        hardNo.trim() ? `絕對不要${hardNo.trim()}` : "",
        environmentLabels.join("、"),
      ].filter(Boolean).join("。");
      const saved = await sidebyApi<{ parse?: { status?: string; clarification?: string | null } }>(
        identity,
        "POST",
        `/api/sessions/${identity.sessionId}/private-inputs`,
        {
          rawText: privateText || "不限",
          selectedPreferences: moods,
          environment: { setting, airConditioning },
          tags: [],
          visibility: remembered ? "private_remembered" : "private_session",
        },
      );
      if (saved.parse?.status !== "parsed") {
        setAiError(true);
        toast.error(saved.parse?.clarification || backendErrors['PRIVATE_INPUT_UNRESOLVED']);
        return;
      }
      await confirmAndGenerate();
      go("plans");
    } catch (error) {
      setAiError(true);
      const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
      toast.error(backendErrors[code] ?? "AI 或 Sideby 後端暫時無法完成分析。");
    } finally {
      setGenerating(false);
    }
  };


  const toggleLock = async (stop: Stop) => {
    if (!identity || !publicState || !stop.backendStopId) return;
    await sidebyApi(identity, "POST", `/api/itineraries/${selectedPlanId}/reactions`, {
      version: publicState.version,
      stopId: stop.backendStopId,
      reaction: "like",
    });
    await refreshSideby();
    toast.success("已記下喜歡；兩人都喜歡這站後才會鎖定。");
  };

  const toggleFavorite = (plan: Plan) => {
    const already = favorites.includes(plan.id);
    setFavorites((prev) => (already ? prev.filter((id) => id !== plan.id) : [...prev, plan.id]));
    toast.success(already ? "已取消收藏" : "已收藏這套方案");
  };

  const replaceStop = async (stop: Stop) => {
    if (!identity || !publicState || !stop.backendStopId) return;
    await sidebyApi(identity, "POST", `/api/itineraries/${selectedPlanId}/reactions`, {
      version: publicState.version,
      stopId: stop.backendStopId,
      reaction: "replace",
    });
    const result = await sidebyApi<{ itinerary: SidebyItinerary }>(
      identity,
      "POST",
      `/api/itineraries/${selectedPlanId}/replan`,
      { version: publicState.version },
    );
    setPlans((current) => current.map((plan, index) => plan.id === selectedPlanId
      ? fromSidebyItinerary(result.itinerary, index)
      : plan));
    toast.success("已保留鎖定站點，只重新安排這一站。");
  };

  const finalizePlan = async () => {
    if (!identity || !publicState) return;
    setFinalStatus("saving");
    const result = await sidebyApi<{ status: "pending_partner" | "choice_conflict" | "finalized" }>(
      identity,
      "POST",
      `/api/sessions/${identity.sessionId}/finalize`,
      { version: publicState.version, itineraryId: selectedPlanId },
    );
    setFinalStatus(result.status);
    setFinalized(result.status === "finalized");
    toast.success(result.status === "pending_partner"
      ? "已選這套，等待另一半選擇同一方案。"
      : result.status === "choice_conflict"
        ? "你們選了不同方案，請再一起確認。"
        : "兩人選擇一致，行程已正式定案！");
  };

  const learnPreference = async (stop: Stop, signal: PreferenceFeedbackSignal, label: string) => {
    if (!identity || !publicState || !stop.backendStopId) return;
    const result = await sidebyApi<{ sessionApplied: boolean; longTermPreferenceVersion: number | null }>(
      identity,
      "POST",
      `/api/itineraries/${selectedPlanId}/preference-feedback`,
      { version: publicState.version, stopId: stop.backendStopId, signal },
    );
    const key = `${stop.backendStopId}:${signal}`;
    setLearnedStops((current) => ({
      ...current,
      [key]: result.longTermPreferenceVersion
        ? `${label}：已更新 v${result.longTermPreferenceVersion}`
        : `${label}：已記錄本次`,
    }));
    if (result.sessionApplied && !finalized) {
      const regenerated = await sidebyApi<{ itineraries: SidebyItinerary[] }>(
        identity, "POST", `/api/sessions/${identity.sessionId}/generate`, { version: publicState.version },
      );
      const nextPlans = regenerated.itineraries.map(fromSidebyItinerary);
      setPlans(nextPlans);
      setSelectedPlanId(nextPlans[0]!.id);
      toast.success(`已依「${label}」重新產生三套方案。`);
    }
  };

  const progress = { room: 20, shared: 40, private: 60, plans: 80, final: 100 }[screen];

  return (
    <div className="app-shell">
      <div className="shape shape-circle mint" />
      <div className="shape shape-circle lilac" />
      <div className="shape shape-triangle yellow" />
      <div className="shape shape-square peach" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span className="brand-word">SideBy</span>
        </div>
        <div className="top-status">
          <span className="status-dot" />
          {room
            ? room.memberCount >= 2
              ? "兩個人的空間"
              : "等另一半加入"
            : "還沒有共同空間"}
          {room && <span className="code-pill">{room.inviteCode}</span>}
        </div>

        <div className="top-actions">
          <button className="icon-btn" aria-label="房間成員">
            <Users size={18} />
          </button>
          {user ? (
            <Link to="/account" className="avatar-btn" aria-label="個人中心">
              {(user.email ?? "?").trim().charAt(0).toUpperCase()}
            </Link>
          ) : authAvailable ? (
            <button className="btn btn-black login-btn" onClick={() => setAuthOpen(true)}>
              登入
            </button>
          ) : (
            <span className="code-pill">免登入展示</span>
          )}
        </div>
      </header>
      {authAvailable && <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />}
      <DateSheet
        open={datePickerOpen}
        value={dateISO}
        onClose={() => setDatePickerOpen(false)}
        onSelect={setDateISO}
      />
      <TimeSheet
        open={timePicker !== null}
        title={timePicker === "end" ? "預計結束" : "開始時間"}
        value={timePicker === "end" ? endTime : startTime}
        onClose={() => setTimePicker(null)}
        onConfirm={(t) => {
          if (timePicker === "end") setEndTime(t);
          else {
            setStartTime(t);
            if (t > endTime && endTime > "06:00") setEndTime(t);
          }
          setTimePicker(null);
        }}
      />
      {leaveAsk && (
        <div className="picker-backdrop" role="dialog" aria-modal="true">
          <button className="picker-scrim" aria-label="關閉" onClick={() => setLeaveAsk(false)} />
          <div className="picker-sheet confirm-sheet">
            <p>要離開嗎？尚未儲存的內容可能會遺失。</p>
            <div className="confirm-actions">
              <button className="btn btn-lilac" onClick={() => setLeaveAsk(false)}>
                繼續編輯
              </button>
              <button
                className="btn btn-black"
                onClick={() => {
                  setLeaveAsk(false);
                  go("room");
                }}
              >
                離開
              </button>
            </div>
          </div>
        </div>
      )}


      <main className="page-wrap">
        <div className="progress-row">
          <span className="eyebrow">DATE LAB / 01</span>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-label">{finalized ? "已完成" : screen === "final" ? "待雙方確認" : "一起規劃中"}</span>
        </div>

        {screen === "room" && (
          <>
            <section className="hero-grid">
              <div className="hero-copy">
                <span className="sticker mint-sticker">
                  <Sparkles size={14} /> FOR TWO, NOT JUST ONE
                </span>
                <h1>
                  把兩個人的想法，<em>排成一條路線。</em>
                </h1>
                <p className="hero-lede">
                  不必為了「去哪裡」來回討論。說出你們想要的感覺，讓 AI 幫你們找到今晚剛剛好的默契。
                </p>
                {room ? (
                  <div className="hero-actions">
                    <button className="btn btn-black" onClick={() => go(publicState?.shared ? "private" : "shared")}>
                      {publicState?.shared ? "填寫我的私密需求" : "開始安排這次約會"} <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="hero-actions">
                    <button className="btn btn-black" onClick={handleCreateRoom} disabled={creating}>
                      {creating ? "正在建立…" : "建立我們的空間"} <ArrowRight size={17} />
                    </button>
                  </div>
                )}
                <div className="proof-line">
                  <span className="avatar-stack">
                    <i>A</i>
                    <i>B</i>
                  </span>
                  <span>
                    兩個人，剛剛好。<strong>一個空間，兩個人共用</strong>
                  </span>
                </div>
              </div>
              <div className="hero-card doodle-card">
                <div className="card-top">
                  <span className="mini-label">NEXT DATE</span>
                  <span className="mini-star">✳</span>
                </div>
                <div className="date-display">
                  今天 <strong>18:00</strong>
                </div>
                <div className="route-preview">
                  <span className="route-node mint-node" />
                  <div>
                    <strong>明亮慢步調</strong>
                    <small>咖啡 · 展覽 · 定食</small>
                  </div>
                  <span className="score-badge">
                    92
                    <br />
                    <small>適合度</small>
                  </span>
                </div>
                <div className="card-squiggle">↝</div>
              </div>
            </section>

            {roomLoading ? (
              <section className="join-strip">
                <p className="join-hint">正在確認你們的空間…</p>
              </section>
            ) : room ? (
              <section className="join-strip">
                <div>
                  <span className="eyebrow">YOUR SIDEBY SPACE</span>
                  <h2>{room.memberCount >= 2 ? "你們已經在同一個空間" : "邀請另一半加入"}</h2>
                  <p className="join-hint">
                    {room.memberCount >= 2
                      ? "兩個人的空間已經配對完成，之後的約會紀錄都會一起留在這裡。"
                      : "把這組邀請碼傳給另一半，對方輸入後就會加入你們共同的 SideBy 空間。"}
                  </p>
                </div>
                <div className="join-form">
                  <span className="invite-code">{room.inviteCode}</span>
                  <button className="btn btn-lilac" onClick={copyInvite}>
                    複製邀請碼
                  </button>
                </div>
              </section>
            ) : (
              <section className="join-strip">
                <div>
                  <span className="eyebrow">JOIN YOUR PARTNER</span>
                  <h2>加入另一半的空間</h2>
                  <p className="join-hint">
                    另一半已經建立 SideBy 空間了嗎？輸入邀請碼就可以加入。
                  </p>
                </div>
                <div className="join-form">
                  <input
                    className="field-input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="輸入邀請碼"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={32}
                  />
                  <button
                    className="btn btn-lilac"
                    onClick={handleJoinRoom}
                    disabled={joining || joinCode.trim().length === 0}
                  >
                    {joining ? "加入中…" : "加入空間"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}


        {screen === "shared" && (
          <section className="flow-section">
            <button className="flow-close" aria-label="關閉建立新的約會" onClick={requestLeave}>
              <X size={20} />
            </button>
            <FlowHeader
              kicker="STEP 01 / TOGETHER"
              title="先決定你們的共同條件"
              desc="這些內容會被兩個人看見，也會一起影響最後的路線。"
            />
            <div className="form-layout">
              <div className="form-card">
                <div className="field-label">這次想安排哪一種約會？</div>
                <div className="segmented">
                  <button
                    className={mode === "now" ? "active" : ""}
                    onClick={() => setMode("now")}
                  >
                    {mode === "now" ? "●" : "○"} 現在就出發
                  </button>
                  <button
                    className={mode === "future" ? "active" : ""}
                    onClick={() => setMode("future")}
                  >
                    {mode === "future" ? "●" : "○"} 規劃未來
                  </button>
                </div>
                <div className="two-col">
                  <label>
                    <span>日期</span>
                    <button className="field-input picker-trigger" onClick={() => setDatePickerOpen(true)}>
                      <CalendarDays size={16} /> {date}
                    </button>
                  </label>
                  <label>
                    <span>開始時間</span>
                    <button className="field-input picker-trigger" onClick={() => setTimePicker("start")}>
                      <Clock size={16} /> {startTime}
                    </button>
                  </label>
                </div>
                <label>
                  <span>預計結束</span>
                  <button className="field-input picker-trigger" onClick={() => setTimePicker("end")}>
                    <Clock size={16} /> {endTime}
                  </button>
                </label>
                <label>
                  <span>集合地點</span>
                  <PlaceField
                    value={location}
                    place={meetPlace}
                    onChange={setLocation}
                    onPick={setMeetPlace}
                  />
                </label>

                <div className="budget-row">
                  <label>
                    <span>理想預算</span>
                    <input
                      className="field-input"
                      value={`NT$ ${Math.max(0, Number(budget) - 600)}`}
                      onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </label>
                  <label>
                    <span>絕對上限</span>
                    <input
                      className="field-input"
                      value={`NT$ ${budget}`}
                      onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </label>
                </div>
                <label>
                  <span>交通方式</span>
                  <div className="choice-row">
                    {["步行", "捷運", "機車", "汽車"].map((t) => (
                      <button
                        key={t}
                        className={`choice ${transport.includes(t) ? "active" : ""}`}
                        onClick={() =>
                          setTransport((prev) =>
                            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                          )
                        }
                      >
                        {transport.includes(t) ? "✓ " : ""}
                        {t}
                      </button>
                    ))}
                  </div>
                </label>
                <button className="btn btn-black wide" onClick={saveSharedConditions} disabled={savingShared}>
                  {savingShared ? "正在同步…" : "確認共同條件"} <ArrowRight size={17} />
                </button>
              </div>
              <aside className="side-note">
                <div className="note-graphic">✦</div>
                <strong>你們正在一起決定</strong>
                <p>時間、預算與集合地點會同步給另一半。個人感受會在下一步分開收集。</p>
                <button className="btn btn-lilac share-button" onClick={copyInvite}>
                  <Share2 size={15} /> 複製邀請連結給另一半
                </button>
                <div className="member-progress">
                  <span>
                    <i className="online-dot" />你 <b>填寫中</b>
                  </span>
                  <span>
                    <i className={partnerJoined ? "online-dot" : "waiting-dot"} />
                    另一半 <b>{partnerJoined ? "已加入" : "等待中"}</b>
                  </span>
                </div>
              </aside>
            </div>
          </section>
        )}

        {screen === "private" && (
          <section className="flow-section">
            <FlowHeader
              kicker="STEP 02 / JUST FOR AI"
              title="現在，說出只有 AI 會看到的事"
              desc="你的答案不會直接顯示給另一半。AI 只會把它轉成安全、中性的配對條件。"
            />
            <div className="private-layout">
              <div className="private-card">
                <div className="privacy-note">
                  <Lock size={15} />
                  <div>
                    <strong>這段內容只用於本次配對</strong>
                    <span>另一半不會看到原始內容；只有你另行同意時才會送至 Gemini。</span>
                  </div>
                </div>

                <div className="pref-block">
                  <div className="block-head">
                    <h4>今天想要什麼感覺？</h4>
                    <small>可複選</small>
                  </div>
                  {PREF_CATEGORIES.map((cat) => {
                    const expanded = expandedCats.includes(cat.key);
                    const shown = expanded ? cat.options : cat.options.slice(0, cat.initial);
                    const hidden = cat.options.length - cat.initial;
                    return (
                      <div className="pref-cat" key={cat.key}>
                        <div className="pref-cat-title">{cat.title}</div>
                        <div className="chip-grid">
                          {shown.map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`mood-chip ${moods.includes(m) ? "selected" : ""}`}
                              onClick={() =>
                                setMoods((prev) =>
                                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                                )
                              }
                            >
                              {moods.includes(m) && <Check size={13} />}
                              {m}
                            </button>
                          ))}
                          {hidden > 0 && (
                            <button
                              type="button"
                              className="chip-more"
                              onClick={() =>
                                setExpandedCats((prev) =>
                                  expanded ? prev.filter((k) => k !== cat.key) : [...prev, cat.key],
                                )
                              }
                            >
                              {expanded ? "收起" : `更多選擇 +${hidden}`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pref-block">
                  <div className="block-head">
                    <h4>環境條件</h4>
                    <small>每組單選，可不限</small>
                  </div>
                  <p className="block-help">每一站的實際使用區域都須符合。戶外包含店內的戶外區；冷氣不明不算符合。雙方條件衝突時需重新選擇。</p>
                  <p className="block-help">偏好會參與配對，但沒有可靠資料的場地屬性不會被當成已符合；可用地點不足時會請你調整條件。</p>
                  <div className="pref-cat">
                    <div className="pref-cat-title">室內／戶外</div>
                    <div className="chip-grid" role="group" aria-label="室內或戶外">
                      {([{ value: null, label: "不限室內外" }, { value: "indoor", label: "室內" },
                        { value: "outdoor", label: "戶外（含戶外區）" }] as const).map(option => (
                        <button key={option.label} type="button" aria-pressed={setting === option.value}
                          className={`mood-chip ${setting === option.value ? "selected" : ""}`}
                          onClick={() => setSetting(option.value)}>{option.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pref-cat">
                    <div className="pref-cat-title">冷氣需求</div>
                    <div className="chip-grid" role="group" aria-label="冷氣需求">
                      {([{ value: null, label: "不限冷氣" }, { value: "required", label: "冷氣" },
                        { value: "excluded", label: "無冷氣" }] as const).map(option => (
                        <button key={option.label} type="button" aria-pressed={airConditioning === option.value}
                          className={`mood-chip ${airConditioning === option.value ? "selected" : ""}`}
                          onClick={() => setAirConditioning(option.value)}>{option.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pref-block">
                  <div className="block-head">
                    <h4>還有什麼想告訴 AI？</h4>
                    <small>選填</small>
                  </div>
                  <p className="block-help">不用整理成條件，直接說就好。</p>
                  <textarea
                    className="field-input"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="例如：今天有點累，不想走太多路。想找可以坐久一點、氣氛舒服的地方。"
                  />
                </div>

                <div className="pref-block">
                  <div className="block-head">
                    <h4>這段內容可以怎麼用？</h4>
                  </div>
                  {preferenceProfile && <p className="block-help">AI 摘要（僅供本人參考）：{[...preferenceProfile.moods, ...preferenceProfile.soft_preferences].join('、') || '尚無摘要'}。正式篩選仍保留你的原始限制。</p>}
                  <label className="visibility-option">
                    <input type="checkbox" checked={modelImprovementOptIn} disabled={!consentsReady || savingConsent || generating}
                      onChange={async event => {
                        const next = event.target.checked;
                        if (!identity) return;
                        setSavingConsent(true);
                        try {
                          await sidebyApi(identity, 'PUT', '/api/me/consents', {
                            termsVersion: '2026-09-05-v1', acceptTerms: true,
                            personalizationEnabled, modelImprovementOptIn: next,
                          });
                          setModelImprovementOptIn(next);
                        } catch { toast.error('資料使用設定儲存失敗，請再試一次。'); }
                        finally { setSavingConsent(false); }
                      }} />
                    <span>允許我的回饋經去識別與人工審核後，用於後續模型改進。可取消，與是否公開、是否記住偏好分開。</span>
                  </label>
                  <div className="visibility-list" role="radiogroup">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={visibility === opt.value}
                        className={`visibility-option ${visibility === opt.value ? "selected" : ""}`}
                        onClick={() => setVisibility(opt.value)}
                      >
                        <span className="vo-dot" />
                        <span className="vo-text">
                          <strong>{opt.label}</strong>
                          <small>{opt.desc}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pref-block hardno-block">
                  <div className="block-head">
                    <h4>絕對不要</h4>
                    <small>AI 一定會避開</small>
                  </div>
                  <input
                    className="field-input"
                    value={hardNo}
                    onChange={(e) => setHardNo(e.target.value)}
                    placeholder="例如：火鍋、戶外、排隊名店、劇烈運動"
                  />
                </div>

                <label className="privacy-note">
                  <input
                    type="checkbox"
                    checked={externalAiConsent}
                    onChange={(event) => setExternalAiConsent(event.target.checked)}
                  />
                  <span>
                    <strong>我確認這是非敏感展示內容，允許送至 Gemini</strong>
                    <small>Gemini 免費層可能使用內容改善 Google 產品；請勿輸入姓名、聯絡方式或真實私密資訊。未勾選只用本機規則。</small>
                  </span>
                </label>

                <button
                  className="btn btn-black wide"
                  onClick={submitPrivate}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="spin" size={17} /> AI 正在理解你的偏好…
                    </>
                  ) : (
                    <>
                      完成我的輸入，開始配對 <ArrowRight size={17} />
                    </>
                  )}
                </button>
                {aiError && (
                  <div className="ai-error">
                    <span>AI 暫時無法分析，再試一次。</span>
                    <button className="btn btn-ghost" onClick={submitPrivate} disabled={generating}>
                      <RefreshCw size={15} /> 再試一次
                    </button>
                  </div>
                )}

              </div>
              <div className="privacy-side">
                <div className="privacy-lock">
                  <Lock size={34} />
                </div>
                <h3>
                  你說的，
                  <br />
                  <em>只留在這裡。</em>
                </h3>
                <p>另一半只會看見「對方已完成」，不會看到你的原句、身份或拒絕原因。</p>
                <div className="privacy-rule">
                  <span>PRIVATE</span>
                  <span>→</span>
                  <span>SAFE SUMMARY</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "plans" && (
          <section className="flow-section">
            <FlowHeader
              kicker="STEP 03 / AI MATCH"
              title="找到 3 種適合你們的走法"
              desc="每套都是完整路線，不只是三個地點。滑一滑，看看哪一種最像你們。"
            />
            {!plansReady ? (
              <div className="ai-error">
                <span>{publicState?.members.length === 2
                  ? "另一半更新需求後，請確認最新版並產生行程。"
                  : "你的需求已保存，等待另一半加入並完成輸入。"}</span>
                <button className="btn btn-black" onClick={() => void confirmAndGenerate().catch((error) => {
                  const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
                  toast.error(backendErrors[code] ?? `目前無法產生行程（${code}）。`);
                })}>
                  同步最新版並產生
                </button>
              </div>
            ) : <>
            <div className="plans-grid">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={`plan-card ${selectedPlanId === plan.id ? "selected" : ""}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className={`plan-banner ${plan.color}`}>
                    <span className="plan-letter">{planLabel(plan.id)}</span>
                    <span className="plan-score">
                      <strong>{plan.score}</strong> 適合度
                    </span>
                  </div>
                  <div className="plan-body">
                    <div className="plan-title-row">
                      <div>
                        <h3>{plan.title}</h3>
                        <p>{plan.subtitle}</p>
                      </div>
                      <button
                        className={`favorite-btn ${favorites.includes(plan.id) ? "favorited" : ""}`}
                        aria-label="收藏方案"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(plan);
                        }}
                      >
                        <Heart
                          size={16}
                          fill={favorites.includes(plan.id) ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <div className="mini-timeline">
                      {plan.stops.map((stop) => (
                        <div className="mini-stop" key={stop.name}>
                          <b>{stop.time}</b>
                          <span className={`stop-dot ${stop.color}`} />
                          <span>{stop.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="plan-footer">
                      <span>{plan.total}</span>
                      <span>{plan.movement}</span>
                    </div>
                    <div className="plan-select">
                      {selectedPlanId === plan.id ? (
                        <>
                          <Check size={15} /> 已選擇
                        </>
                      ) : (
                        "查看這套"
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="plans-bottom">
              <span>
                <span className="sync-dot" />
                另一半正在看 <strong>方案 {planLabel(selectedPlanId)}</strong>
              </span>
              <button className="btn btn-black" onClick={() => go("final")}>
                查看完整行程 <ArrowRight size={17} />
              </button>
            </div>
            </>}
          </section>
        )}

        {screen === "final" && (
          <section className="flow-section">
            <button className="back-action" onClick={() => go("plans")}>
              <ArrowLeft size={17} /> 回到方案比較
            </button>
            <FlowHeader
              kicker={`方案 ${planLabel(currentPlan.id)} / FINAL ROUTE`}
              title="今晚，就照這條走。"
              desc={currentPlan.dataMode === "synthetic_demo"
                ? "這是合成展示資料，用來驗證完整雙人流程；不是現實世界推薦。"
                : "你們已經選好方向，這是一條可以直接出發的路線。"}
            />
            <div className="final-layout">
              <div className="final-timeline card-surface">
                <div className="final-head">
                  <div>
                    <span className={`sticker ${currentPlan.color}-sticker`}>
                      {finalized ? "✓ 已確認的最終行程" : "♥ 你們的最終行程"}
                    </span>
                    <h2>{currentPlan.title}</h2>
                  </div>
                  <span className="final-score">
                    {currentPlan.score}
                    <small>適合度</small>
                  </span>
                </div>
                {origin && (
                  <div className="timeline-row origin-row">
                    <div className="time-col">現在</div>
                    <div className="timeline-dot yellow" />
                    <div className="stop-detail">
                      <div>
                        <span className="stop-type">出發點</span>
                        <h3>{originLabel}</h3>
                        <p>已使用你目前的位置作為起點</p>
                      </div>
                      <TravelChips leg={legs[0]} />
                    </div>
                  </div>
                )}
                {currentPlan.stops.map((stop, index) => {
                  const venue = stop.googlePlaceId ? venues[stop.googlePlaceId] : undefined;
                  return (
                    <div className="timeline-row" key={stop.name}>
                      <div className="time-col">{stop.time}</div>
                      <div className={`timeline-dot ${stop.color}`}>
                        <span>{index === 0 ? "◎" : index}</span>
                      </div>
                      <div className="stop-detail">
                        <div>
                          <span className="stop-type">{stop.type}</span>
                          <h3>{venue?.name ?? stop.name}</h3>
                          <p>{stop.meta}</p>
                        </div>
                        {venue && <VenueDetails venue={venue} />}
                        {index < currentPlan.stops.length - 1 && (currentPlan.dataMode === "synthetic_demo" && legs.length === 0 ? (
                          <div className="travel-line"><span>合成交通矩陣：{stop.travelMinutes ?? 0} 分鐘</span></div>
                        ) : <TravelChips leg={legFor(index)} />)}
                      </div>
                      <div className="stop-actions">
                        {currentPlan.dataMode !== "synthetic_demo" && !venue && stop.mapsUrl && (
                          <a className="replace-stop" href={stop.mapsUrl} target="_blank" rel="noreferrer">在 Google Maps 查看</a>
                        )}
                        {!finalized && <button
                          className={`lock-stop ${lockedStops.includes(stop.name) ? "locked" : ""}`}
                          disabled={lockedStops.includes(stop.name)}
                          onClick={() => void toggleLock(stop).catch((error) => {
                            const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
                            toast.error(backendErrors[code] ?? `目前無法記錄喜歡（${code}）。`);
                          })}
                        >
                          {lockedStops.includes(stop.name) ? "雙方已鎖定" : "喜歡這站"}
                        </button>}
                        {!finalized && !lockedStops.includes(stop.name) && index > 0 && (
                          <button className="replace-stop" onClick={() => void replaceStop(stop).catch((error) => {
                            const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
                            toast.error(backendErrors[code] ?? `目前無法替換（${code}）。`);
                          })}>
                            替換
                          </button>
                        )}
                        {stop.backendStopId && preferenceFeedbackOptions.map(({ signal, label }) => {
                          const key = `${stop.backendStopId}:${signal}`;
                          return <button key={signal} className="replace-stop" disabled={Boolean(learnedStops[key])}
                            onClick={() => void learnPreference(stop, signal, label).catch((error) => {
                              const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
                              toast.error(backendErrors[code] ?? `目前無法更新偏好（${code}）。`);
                            })}>
                            {learnedStops[key] ?? label}
                          </button>;
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="final-summary">
                  <span>
                    <strong>{durationLabel(currentPlan.durationMinutes)}</strong>總時間
                  </span>
                  <span>
                    <strong>{currentPlan.total}</strong>預估總額
                  </span>
                  <span>
                    <strong>{currentPlan.movement}</strong>交通
                  </span>
                </div>
                {mapsError && (
                  <p className="venue-address">實際場館資料暫時取不到，稍後會自動重試。</p>
                )}
              </div>
              {currentPlan.dataMode === "synthetic_demo" && mapStops.length === 0 ? (
                <aside className="map-card live-map">
                  <div className="map-status"><MapPin size={15} /> 正在以核准的 Google Place ID 載入場地；方案時間、價格與分數仍是展示資料。</div>
                  <div className="map-label">Sideby 展示方案 × Google 即時地圖資料</div>
                </aside>
              ) : <>
                <DateMap stops={mapStops} />
                {currentPlan.dataMode === "synthetic_demo" && (
                  <div className="map-label">場地位置與導航由 Google 即時載入；時間、價格、屬性與推薦分數為 Sideby 黑客松展示設定。</div>
                )}
              </>}
            </div>

            <div className="final-actions">
              {finalStatus === "pending_partner" && (
                <p className="venue-address">你已選擇方案 {planLabel(selectedPlanId)}，等待另一半確認同一套。</p>
              )}
              {finalStatus === "choice_conflict" && (
                <p className="venue-address">你們目前選了不同方案，請回到方案比較重新選擇。</p>
              )}
              <button
                className="btn btn-black"
                disabled={finalized || finalStatus === "saving"}
                onClick={() => void finalizePlan().catch((error) => {
                  setFinalStatus("idle");
                  const code = error instanceof SidebyApiError ? error.code : "SERVICE_UNAVAILABLE";
                  toast.error(backendErrors[code] ?? `目前無法定案（${code}）。`);
                })}
              >
                {finalized ? "雙方已確認這條路線" : finalStatus === "saving" ? "正在確認…" : "確認這條路線"} {!finalized && finalStatus !== "saving" && <Heart size={17} />}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  toast.success("已保留鎖定站點，準備局部調整");
                  go("plans");
                }}
              >
                調整其中一站 <RefreshCw size={17} />
              </button>
            </div>
          </section>
        )}
      </main>

      <nav className="mobile-bottom">
        <button className={screen === "room" ? "active" : ""} onClick={() => go("room")}>
          <Sparkles size={18} />
          <span>房間</span>
        </button>
        <button className={screen === "shared" ? "active" : ""} onClick={() => go("shared")}>
          <Users size={18} />
          <span>共同條件</span>
        </button>
        <button
          className={screen === "plans" || screen === "final" ? "active" : ""}
          onClick={() => go("plans")}
        >
          <RefreshCw size={18} />
          <span>行程</span>
        </button>
      </nav>
    </div>
  );
}
