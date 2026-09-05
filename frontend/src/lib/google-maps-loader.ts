/// <reference types="google.maps" />
let loaderPromise: Promise<typeof google.maps> | undefined;

const CALLBACK_NAME = "__sideByMapsReady";

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const key = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"]?.trim();
    if (!key) {
      reject(new Error("請先在 frontend/.env.local 填入 VITE_GOOGLE_MAPS_API_KEY，然後重啟前端"));
      return;
    }
    if (typeof google !== "undefined" && google.maps?.Map) {
      resolve(google.maps);
      return;
    }

    const global = window as unknown as Record<string, unknown>;
    const timer = window.setTimeout(() => reject(new Error("Google 地圖載入逾時，請檢查網路與金鑰限制")), 15000);
    global[CALLBACK_NAME] = () => { window.clearTimeout(timer); resolve(google.maps); };
    global["gm_authFailure"] = () => { window.clearTimeout(timer); reject(new Error("Google 地圖授權失敗，請檢查瀏覽器金鑰、來源限制與帳務")); };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: "async", language: "zh-TW", region: "TW", callback: CALLBACK_NAME })}`;
    script.async = true;
    script.onerror = () => { window.clearTimeout(timer); reject(new Error("地圖載入失敗")); };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
