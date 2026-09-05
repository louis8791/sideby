import { createFileRoute } from "@tanstack/react-router";
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
  Link2,
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
import { ProfileMenu } from "@/components/ProfileMenu";
import { DateMap, type MapStop } from "@/components/DateMap";
import { DateSheet, TimeSheet, formatDateLabel } from "@/components/DateSheet";
import { PlaceField } from "@/components/PlaceField";

import { useSession } from "@/lib/use-session";
import { computeTravelLegs, resolveVenues, type TravelLeg, type Venue } from "@/lib/maps.functions";
import { analyzePreferenceInput } from "@/lib/preferences.functions";
import type { PreferenceProfile } from "@/lib/preference-types";



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
  time: string;
  name: string;
  type: string;
  meta: string;
  color: string;
  query: string;
};
type Plan = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  score: number;
  total: string;
  movement: string;
  stops: Stop[];
  reason: string;
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

const MOODS = ["明亮", "可愛", "安靜", "浪漫", "放鬆", "有趣"];

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
        <img className="venue-photo" src={venue.photoUri} alt={`${venue.name} 實景照片`} loading="lazy" />
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
  const [authOpen, setAuthOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("room");
  const [role] = useState("A");
  const [inviteCode, setInviteCode] = useState("842716");
  const [joinCode, setJoinCode] = useState("");
  const [partnerJoined, setPartnerJoined] = useState(false);

  const todayISO = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }, []);
  const [dateISO, setDateISO] = useState(todayISO);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("22:00");
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
  const [moods, setMoods] = useState<string[]>(["明亮", "放鬆"]);
  const [rawText, setRawText] = useState("");
  const [hardNo, setHardNo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile | null>(null);
  const runPreferenceAnalysis = useServerFn(analyzePreferenceInput);


  const [selectedPlanId, setSelectedPlanId] = useState("A");
  const [lockedStops, setLockedStops] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [finalized, setFinalized] = useState(false);

  const currentPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0]!,
    [plans, selectedPlanId],
  );

  // ---- Real Google Places / Routes data for the selected itinerary ----
  const lookupVenues = useServerFn(resolveVenues);
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

  const stopQueries = useMemo(
    () => currentPlan.stops.map((s) => s.query).join("|"),
    [currentPlan],
  );

  useEffect(() => {
    if (screen !== "final" && screen !== "plans") return;
    let cancelled = false;
    const queries = stopQueries.split("|").filter(Boolean);
    lookupVenues({ data: { queries } })
      .then((res) => {
        if (cancelled) return;
        setVenues((prev) => {
          const next = { ...prev };
          res.venues.forEach((v) => {
            next[v.query] = v;
          });
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setMapsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [screen, stopQueries, lookupVenues]);

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
      const venue = venues[stop.query];
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



  const createRoom = () => {
    setInviteCode(String(Math.floor(100000 + Math.random() * 899999)));
    setPartnerJoined(false);
    toast.success("房間已建立，邀請連結可以分享了");
    go("shared");
  };

  const copyInvite = async () => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard?.writeText(`${origin}/room/${inviteCode}`).catch(() => null);
    toast.success("邀請連結已複製");
  };

  const joinRoom = () => {
    if (joinCode.length >= 4) {
      setInviteCode(joinCode);
      setPartnerJoined(true);
      toast.success("已加入雙人房間");
      go("shared");
    } else {
      toast.error("請輸入邀請碼");
    }
  };

  const submitPrivate = async () => {
    setGenerating(true);
    setAiError(false);
    try {
      const result = await runPreferenceAnalysis({
        data: { moods, freeText: rawText, hardNo, visibility },
      });
      setPreferenceProfile(result.profile);
      setPartnerJoined(true);
      toast.success("AI 已完成新一輪配對");
      go("plans");
    } catch {
      setAiError(true);
    } finally {
      setGenerating(false);
    }
  };


  const toggleLock = (stop: Stop) => {
    const locked = lockedStops.includes(stop.name);
    setLockedStops((prev) => (locked ? prev.filter((n) => n !== stop.name) : [...prev, stop.name]));
  };

  const toggleFavorite = (plan: Plan) => {
    const already = favorites.includes(plan.id);
    setFavorites((prev) => (already ? prev.filter((id) => id !== plan.id) : [...prev, plan.id]));
    toast.success(already ? "已取消收藏" : "已收藏這套方案");
  };

  const replaceStop = (stop: Stop) => {
    const replacement: Stop =
      stop.type === "展覽"
        ? {
            ...stop,
            name: "陶作坊 台北",
            type: "雙人手作",
            meta: "90 分鐘 · NT$880",
            color: "lilac",
            query: "陶作坊 台北",
          }
        : {
            ...stop,
            name: "大稻埕碼頭",
            type: "散步",
            meta: "35 分鐘 · 免費",
            color: "mint",
            query: "大稻埕碼頭 台北",
          };

    setPlans((prev) =>
      prev.map((p) =>
        p.id !== selectedPlanId
          ? p
          : { ...p, stops: p.stops.map((s) => (s.name !== stop.name ? s : replacement)) },
      ),
    );
    toast.success("只替換這一站，其餘行程已保留");
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
          <span>SideBy</span>
        </div>
        <div className="top-status">
          <span className="status-dot" />
          雙人房間已開啟 <span className="code-pill">{inviteCode}</span>
        </div>
        <div className="top-actions">
          <button className="icon-btn" aria-label="房間成員">
            <Users size={18} />
          </button>
          {user ? (
            <ProfileMenu user={user} />
          ) : (
            <button className="btn btn-black login-btn" onClick={() => setAuthOpen(true)}>
              登入
            </button>
          )}
        </div>
      </header>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
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
          <span className="progress-label">{screen === "final" ? "已完成" : "一起規劃中"}</span>
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
                <div className="hero-actions">
                  <button className="btn btn-black" onClick={createRoom}>
                    建立新的約會房間 <ArrowRight size={17} />
                  </button>
                  <button className="text-action" onClick={() => setJoinCode("842716")}>
                    我有邀請碼 <Link2 size={16} />
                  </button>
                </div>
                <div className="proof-line">
                  <span className="avatar-stack">
                    <i>A</i>
                    <i>B</i>
                  </span>
                  <span>
                    兩個人，剛剛好。<strong>不用註冊也能開始</strong>
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

            <section className="join-strip">
              <div>
                <span className="eyebrow">JOIN YOUR PARTNER</span>
                <h2>另一半已經建立房間？</h2>
              </div>
              <div className="join-form">
                <input
                  className="field-input"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="輸入 6 位邀請碼"
                  maxLength={6}
                />
                <button className="btn btn-lilac" onClick={joinRoom}>
                  加入房間
                </button>
              </div>
            </section>
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
                <button className="btn btn-black wide" onClick={() => go("private")}>
                  確認共同條件 <ArrowRight size={17} />
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
                <div className="privacy-banner">
                  <Lock size={18} />
                  <div>
                    <strong>私密輸入已加密</strong>
                    <span>只有 AI 會使用這段內容</span>
                  </div>
                  <span className="toggle-on">ON</span>
                </div>
                <div className="field-label">
                  今天想要什麼感覺？<small>可複選</small>
                </div>
                <div className="chip-grid">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      className={`mood-chip ${moods.includes(m) ? "selected" : ""}`}
                      onClick={() =>
                        setMoods((prev) =>
                          prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
                        )
                      }
                    >
                      {moods.includes(m) && <Check size={14} />}
                      {m}
                    </button>
                  ))}
                </div>
                <label>
                  <span>
                    你可以直接說 <small>選填</small>
                  </span>
                  <textarea
                    className="field-input"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="例如：想找明亮一點的咖啡廳，可愛但不要太幼稚。今天有點累，不想走太多路。"
                  />
                </label>
                <div className="privacy-options">
                  <span>這段內容：</span>
                  <button
                    className={visibility === "private_session" ? "selected" : ""}
                    onClick={() => setVisibility("private_session")}
                  >
                    {visibility === "private_session" ? "●" : "○"} 只限本次
                  </button>
                  <button
                    className={visibility === "private_remembered" ? "selected" : ""}
                    onClick={() => setVisibility("private_remembered")}
                  >
                    {visibility === "private_remembered" ? "●" : "○"} 讓 AI 之後也記得
                  </button>
                  <button
                    className={visibility === "shared" ? "selected" : ""}
                    onClick={() => setVisibility("shared")}
                  >
                    {visibility === "shared" ? "●" : "○"} 可以讓另一半看到
                  </button>
                </div>
                <label>
                  <span>
                    絕對不要 <small>Hard no</small>
                  </span>
                  <input
                    className="field-input"
                    value={hardNo}
                    onChange={(e) => setHardNo(e.target.value)}
                    placeholder="輸入不想去的類型，例如：火鍋、劇烈運動"
                  />
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
            <div className="plans-grid">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={`plan-card ${selectedPlanId === plan.id ? "selected" : ""}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div className={`plan-banner ${plan.color}`}>
                    <span className="plan-letter">{plan.id}</span>
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
                另一半正在看 <strong>方案 {selectedPlanId}</strong>
              </span>
              <button className="btn btn-black" onClick={() => go("final")}>
                查看完整行程 <ArrowRight size={17} />
              </button>
            </div>
          </section>
        )}

        {screen === "final" && (
          <section className="flow-section">
            <button className="back-action" onClick={() => go("plans")}>
              <ArrowLeft size={17} /> 回到方案比較
            </button>
            <FlowHeader
              kicker={`方案 ${currentPlan.id} / FINAL ROUTE`}
              title="今晚，就照這條走。"
              desc="你們已經選好方向，這是一條可以直接出發的路線。"
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
                  const venue = venues[stop.query];
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
                        {index < currentPlan.stops.length - 1 && (
                          <TravelChips leg={legFor(index)} />
                        )}
                      </div>
                      <div className="stop-actions">
                        <button
                          className={`lock-stop ${lockedStops.includes(stop.name) ? "locked" : ""}`}
                          onClick={() => toggleLock(stop)}
                        >
                          {lockedStops.includes(stop.name) ? "已鎖定" : "鎖定這站"}
                        </button>
                        {!lockedStops.includes(stop.name) && index > 0 && (
                          <button className="replace-stop" onClick={() => replaceStop(stop)}>
                            替換
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="final-summary">
                  <span>
                    <strong>3 小時 55 分</strong>總時間
                  </span>
                  <span>
                    <strong>{currentPlan.total}</strong>預估總額
                  </span>
                  <span>
                    <strong>捷運＋步行</strong>交通
                  </span>
                </div>
                {mapsError && (
                  <p className="venue-address">實際場館資料暫時取不到，稍後會自動重試。</p>
                )}
              </div>
              <DateMap stops={mapStops} />
            </div>

            <div className="final-actions">
              <button
                className="btn btn-black"
                disabled={finalized}
                onClick={() => {
                  setFinalized(true);
                  toast.success("行程已確認，祝你們約會愉快！");
                }}
              >
                {finalized ? "已確認這條路線" : "確認這條路線"} {!finalized && <Heart size={17} />}
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
