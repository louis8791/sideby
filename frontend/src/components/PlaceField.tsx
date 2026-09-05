import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  autocompletePlaces,
  getPlaceDetails,
  type PlaceSuggestion,
  type Venue,
} from "@/lib/maps.functions";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { GoogleAttribution } from "./GoogleAttribution";

function MiniMap({ place }: { place: Venue }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    let marker: google.maps.Marker | undefined;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !ref.current) return;
        const map = new maps.Map(ref.current, {
          center: { lat: place.lat, lng: place.lng },
          zoom: 16,
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          backgroundColor: "#f7f1ea",
        });
        marker = new maps.Marker({
          map,
          position: { lat: place.lat, lng: place.lng },
          title: place.name,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#8fe0c8",
            fillOpacity: 1,
            strokeColor: "#151515",
            strokeWeight: 2,
          },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      marker?.setMap(null);
    };
  }, [place.lat, place.lng, place.name]);

  return <div className="place-preview-map" ref={ref} />;
}

export function PlaceField({
  value,
  place,
  onChange,
  onPick,
}: {
  value: string;
  place: Venue | null;
  onChange: (text: string) => void;
  onPick: (venue: Venue | null) => void;
}) {
  const search = useServerFn(autocompletePlaces);
  const details = useServerFn(getPlaceDetails);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(value);
  const [picked, setPicked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      search({ data: { input: text } })
        .then((res) => setSuggestions(res.suggestions))
        .catch(() => { setSuggestions([]); setError("地點服務尚未設定或暫時不可用，請到 /maps-check 檢查"); })
        .finally(() => setBusy(false));
    }, 320);
    return () => clearTimeout(timer);
  }, [query, open, search]);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    setPicked(true);
    setSuggestions([]);
    setQuery(s.name);
    onChange(s.name);
    try {
      const res = await details({ data: { placeId: s.placeId } });
      onPick(res.venue);
    } catch {
      onPick(null);
      setError("地點詳情暫時無法取得，請重新選擇或檢查 Google 設定");
    }
  };

  return (
    <div className="place-field">
      <div className="input-icon">
        <Search size={17} />
        <input
          className="field-input"
          value={query}
          inputMode="search"
          autoComplete="off"
          placeholder="搜尋地點、捷運站、餐廳或地址"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setPicked(false);
            onPick(null);
          }}
        />
      </div>
      {open && !picked && (query.trim().length >= 2 || busy) && (
        <div className="place-suggestions">
          {busy && suggestions.length === 0 && <div className="place-empty">正在搜尋地點…</div>}
          {!busy && !error && suggestions.length === 0 && <div className="place-empty">找不到相符的地點</div>}
          {suggestions.map((s) => (
            <button key={s.placeId} className="place-option" onClick={() => pick(s)}>
              <MapPin size={15} />
              <span>
                <strong>{s.name}</strong>
                {s.secondary && <small>{s.secondary}</small>}
              </span>
            </button>
          ))}
          {suggestions.length > 0 && <GoogleAttribution />}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {place && (
        <div className="place-preview">
          <MiniMap place={place} />
          <div className="place-preview-info">
            <strong>{place.name}</strong>
            {place.address && <small>{place.address}</small>}
            <GoogleAttribution />
            <a
              className="venue-btn"
              href={place.googleMapsUri}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={14} /> 在 Google 地圖查看
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
