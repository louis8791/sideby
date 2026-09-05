import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getMapsConfiguration, resolveVenues, computeTravelLegs, geocodeAddress } from "@/lib/maps.functions";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { GoogleAttribution } from "@/components/GoogleAttribution";

export const Route = createFileRoute("/maps-check")({ component: MapsCheck });

function MapsCheck() {
  const configuration = useServerFn(getMapsConfiguration);
  const search = useServerFn(resolveVenues);
  const routes = useServerFn(computeTravelLegs);
  const geocode = useServerFn(geocodeAddress);
  const canvas = useRef<HTMLDivElement>(null);
  const [server, setServer] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const browser = Boolean(import.meta.env["VITE_GOOGLE_MAPS_API_KEY"]?.trim());
  useEffect(() => {
    configuration().then(r => setServer(r.serverKeyPresent)).catch(() => setConfigError("設定檢查失敗：請使用本機開發入口，並重啟前端。"));
  }, [configuration]);

  async function check() {
    setBusy(true);
    setResults({});
    const run = async (name: string, task: () => Promise<string>) => {
      try { const message = await task(); setResults(prev => ({ ...prev, [name]: message })); }
      catch (error) { setResults(prev => ({ ...prev, [name]: error instanceof Error ? error.message : "未通過：請檢查 API 啟用、金鑰限制、帳務、配額或網路。" })); }
    };
    // Deliberately public landmarks. No device geolocation, partner data or private preferences.
    await run("Maps JavaScript API", async () => {
      const maps = await loadGoogleMaps();
      if (!canvas.current) throw new Error("Map container missing");
      new maps.Map(canvas.current, { center: { lat: 25.0478, lng: 121.5319 }, zoom: 15 });
      return "程式已載入；仍需目視確認下方地圖底圖正常（非僅載入程式就算通過）。";
    });
    await run("Places API (New)", async () => {
      const { venues } = await search({ data: { queries: ["臺北車站"] } });
      return venues[0] ? `收到地點：${venues[0].name} — ${venues[0].address}` : "請求成功但沒有地點，不算展示驗收通過。";
    });
    await run("Routes API", async () => {
      const { legs } = await routes({ data: { points: [
        { label: "臺北車站", lat: 25.0478, lng: 121.5319 },
        { label: "北門", lat: 25.0492, lng: 121.5103 },
      ] } });
      const leg = legs[0];
      return `步行：${leg?.walkMinutes === undefined ? "無可用路線" : `${leg.walkMinutes} 分鐘`}；大眾運輸：${leg?.transitMinutes === undefined ? "無可用路線" : `${leg.transitMinutes} 分鐘`}。未回傳的路線不補值。`;
    });
    await run("Geocoding API", async () => {
      const { location } = await geocode({ data: { address: "臺北市中正區北平西路3號" } });
      return location ? `${location.address}：${location.lat}, ${location.lng}（${location.precision}${location.partialMatch ? "，部分符合，需確認" : ""}）` : "查無地址；不補假座標。";
    });
    setBusy(false);
  }

  return <main style={{ maxWidth: 800, margin: "40px auto", padding: 24, lineHeight: 1.8 }}>
    <a href="/">Sideby 首頁</a>
    <h1 style={{ fontSize: 28, fontWeight: 700 }}>Google 地圖本機設定</h1>
    <p>只驗地圖，不需要 Supabase 或 Gemini。此頁不接收、不儲存金鑰。</p>
    <ol style={{ listStyle: "decimal", paddingLeft: 24 }}>
      <li>在自己的 Google Cloud 專案啟用四項 API，確認帳務、金鑰限制與配額。</li>
      <li>開啟 E:\sideby\frontend\.env.local，在兩個欄位分別貼入瀏覽器與伺服器金鑰。</li>
      <li>儲存、重啟前端，再重新整理此頁。不要把金鑰貼在對話或 GitHub。</li>
    </ol>
    <p>瀏覽器金鑰：{browser ? "已填入（未驗證）" : "待填入 VITE_GOOGLE_MAPS_API_KEY"}</p>
    <p>伺服器金鑰：{configError ? "無法檢查" : server === null ? "檢查中…" : server ? "已填入（未驗證）" : "待填入 GOOGLE_MAPS_SERVER_API_KEY"}</p>
    {configError && <p role="alert">{configError}</p>}
    <p>填寫說明：docs/GOOGLE_MAPS_LOCAL_SETUP.md。首頁的登入、AI 與雙人流程需要另外串接及驗收。</p>
    <button className="venue-btn" disabled={!browser || !server || busy} onClick={check}>
      {busy ? "檢查中…" : "檢查四項連線（會呼叫 Google，可能計費）"}
    </button>
    <p>未按按鈕不呼叫 Google Maps 服務；測試使用公開地標、不讀取你的定位。</p>
    <div role="status" aria-live="polite">{Object.entries(results).map(([name, message]) => <section key={name} style={{ border: "1px solid #ddd", padding: 12, marginTop: 12 }}>
      <h2 style={{ fontWeight: 700 }}>{name}</h2><p>{message}</p><GoogleAttribution />
    </section>)}</div>
    <div ref={canvas} aria-label="Google 地圖驗收區" style={{ height: 320, marginTop: 20, background: "#eee" }} />
    <p>整體狀態：等待真實服務、底圖目視與 Owner 驗收。金鑰存在不代表服務成功。</p>
  </main>;
}
