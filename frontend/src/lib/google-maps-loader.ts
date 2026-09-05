/// <reference types="google.maps" />
let loaderPromise: Promise<typeof google.maps> | undefined;

const CALLBACK_NAME = "__sideByMapsReady";

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    if (!key) {
      reject(new Error("地圖金鑰尚未設定"));
      return;
    }
    if (typeof google !== "undefined" && google.maps?.Map) {
      resolve(google.maps);
      return;
    }

    (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => resolve(google.maps);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&language=zh-TW&region=TW&callback=${CALLBACK_NAME}&channel=${channel}`;
    script.async = true;
    script.onerror = () => reject(new Error("地圖載入失敗"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
