import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

export type MapStop = {
  label: string;
  lat: number;
  lng: number;
  color: string;
  order: string;
  isOrigin?: boolean;
};

const MARKER_COLORS: Record<string, string> = {
  mint: "#8fe0c8",
  lilac: "#c9bdf5",
  yellow: "#ffd75e",
  peach: "#ffb9a3",
};

export function DateMap({ stops }: { stops: MapStop[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || stops.length === 0) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: stops[0]!.lat, lng: stops[0]!.lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          backgroundColor: "#f7f1ea",
        });

        const bounds = new maps.LatLngBounds();
        const info = new maps.InfoWindow();

        stops.forEach((stop, index) => {
          const position = { lat: stop.lat, lng: stop.lng };
          bounds.extend(position);
          const marker = new maps.Marker({
            map,
            position,
            title: stop.label,
            zIndex: 10 + index,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: stop.isOrigin ? 11 : 14,
              fillColor: stop.isOrigin ? "#ffffff" : (MARKER_COLORS[stop.color] ?? "#8fe0c8"),
              fillOpacity: 1,
              strokeColor: "#151515",
              strokeWeight: 2,
            },
            label: {
              text: stop.order,
              color: "#151515",
              fontSize: "12px",
              fontWeight: "700",
            },
          });
          marker.addListener("click", () => {
            info.setContent(
              `<div style="font-family:'Noto Sans TC',sans-serif;font-weight:600;font-size:13px;color:#151515">${stop.label}</div>`,
            );
            info.open(map, marker);
          });
          cleanups.push(() => marker.setMap(null));
        });

        if (stops.length > 1) {
          const path = new maps.Polyline({
            map,
            path: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
            geodesic: true,
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeColor: "#151515", strokeOpacity: 0.75, scale: 3 },
                offset: "0",
                repeat: "12px",
              },
            ],
          });
          cleanups.push(() => path.setMap(null));
          map.fitBounds(bounds, { top: 48, right: 40, bottom: 48, left: 40 });
        }

        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [stops]);

  return (
    <aside className="map-card live-map">
      <div ref={containerRef} className="map-canvas" />
      {!ready && !error && <div className="map-status">正在載入實際地圖…</div>}
      {error && (
        <div className="map-status">
          <MapPin size={15} /> 地圖暫時無法顯示（{error}）
        </div>
      )}
      <div className="map-label">
        <MapPin size={16} /> 實際路線與站點順序
        <br />
        <small>編號 1 → {Math.max(1, stops.length - 1)} 依行程順序</small>
      </div>
    </aside>
  );
}
