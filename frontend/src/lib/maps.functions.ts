import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

// Taipei / New Taipei bias — every venue lookup is anchored here.
const TAIPEI = { latitude: 25.0478, longitude: 121.5319 };
const BIAS_RADIUS_M = 30000;

export type Venue = {
  query: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  category?: string;
  photoUri?: string;
  googleMapsUri: string;
};

export type TravelLeg = {
  from: string;
  to: string;
  walkMinutes?: number;
  transitMinutes?: number;
  distanceKm?: number;
};

function gatewayHeaders(extra: Record<string, string> = {}) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps 連線尚未設定完成");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    ...extra,
  };
}

async function readError(response: Response, label: string): Promise<never> {
  const body = await response.text();
  console.error(`${label} failed [${response.status}]: ${body}`);
  throw new Error(`${label} failed [${response.status}]: ${body}`);
}

async function photoUrl(photoName: string): Promise<string | undefined> {
  const response = await fetch(
    `${GATEWAY}/places/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
    { headers: gatewayHeaders() },
  );
  if (!response.ok) {
    console.error(`place photo failed [${response.status}]: ${await response.text()}`);
    return undefined;
  }
  const payload = (await response.json()) as { photoUri?: string };
  return payload.photoUri;
}

async function searchVenue(query: string): Promise<Venue | null> {
  const response = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/json",
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.currentOpeningHours.openNow",
        "places.primaryTypeDisplayName",
        "places.photos.name",
        "places.googleMapsUri",
      ].join(","),
    }),
    body: JSON.stringify({
      textQuery: query,
      languageCode: "zh-TW",
      regionCode: "TW",
      maxResultCount: 1,
      locationBias: { circle: { center: TAIPEI, radius: BIAS_RADIUS_M } },
    }),
  });
  if (!response.ok) await readError(response, "Places searchText");

  const payload = (await response.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      rating?: number;
      userRatingCount?: number;
      currentOpeningHours?: { openNow?: boolean };
      primaryTypeDisplayName?: { text?: string };
      photos?: Array<{ name: string }>;
      googleMapsUri?: string;
    }>;
  };

  const place = payload.places?.[0];
  if (!place?.location) return null;

  const firstPhoto = place.photos?.[0]?.name;
  const venue: Venue = {
    query,
    placeId: place.id,
    name: place.displayName?.text ?? query,
    address: place.formattedAddress ?? "",
    lat: place.location.latitude,
    lng: place.location.longitude,
    googleMapsUri:
      place.googleMapsUri ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${place.id}`,
  };
  if (typeof place.rating === "number") venue.rating = place.rating;
  if (typeof place.userRatingCount === "number") venue.ratingCount = place.userRatingCount;
  if (typeof place.currentOpeningHours?.openNow === "boolean")
    venue.openNow = place.currentOpeningHours.openNow;
  if (place.primaryTypeDisplayName?.text) venue.category = place.primaryTypeDisplayName.text;
  if (firstPhoto) {
    const uri = await photoUrl(firstPhoto);
    if (uri) venue.photoUri = uri;
  }
  return venue;
}

const venueCache = new Map<string, Venue | null>();

export const resolveVenues = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ queries: z.array(z.string().min(1).max(120)).min(1).max(8) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const unique = Array.from(new Set(data.queries));
    const venues: Array<Venue | null> = [];
    for (const query of unique) {
      if (!venueCache.has(query)) {
        venueCache.set(query, await searchVenue(query));
      }
      venues.push(venueCache.get(query) ?? null);
    }
    return { venues: venues.filter((v): v is Venue => v !== null) };
  });

async function computeLeg(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: "WALK" | "TRANSIT",
): Promise<{ minutes?: number; distanceKm?: number }> {
  const response = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: gatewayHeaders({
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    }),
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      travelMode,
      languageCode: "zh-TW",
      regionCode: "TW",
    }),
  });
  if (!response.ok) {
    console.error(`Routes computeRoutes failed [${response.status}]: ${await response.text()}`);
    return {};
  }
  const payload = (await response.json()) as {
    routes?: Array<{ duration?: string; distanceMeters?: number }>;
  };
  const route = payload.routes?.[0];
  if (!route) return {};
  const seconds = Number(String(route.duration ?? "").replace("s", ""));
  const result: { minutes?: number; distanceKm?: number } = {};
  if (Number.isFinite(seconds) && seconds > 0) result.minutes = Math.max(1, Math.round(seconds / 60));
  if (typeof route.distanceMeters === "number")
    result.distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
  return result;
}

const pointSchema = z.object({
  label: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const computeTravelLegs = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ points: z.array(pointSchema).min(2).max(8) }).parse(data))
  .handler(async ({ data }) => {
    const legs: TravelLeg[] = [];
    for (let i = 0; i < data.points.length - 1; i += 1) {
      const from = data.points[i]!;
      const to = data.points[i + 1]!;
      const [walk, transit] = await Promise.all([
        computeLeg(from, to, "WALK"),
        computeLeg(from, to, "TRANSIT"),
      ]);
      const leg: TravelLeg = { from: from.label, to: to.label };
      if (walk.minutes) leg.walkMinutes = walk.minutes;
      if (transit.minutes) leg.transitMinutes = transit.minutes;
      const distance = walk.distanceKm ?? transit.distanceKm;
      if (distance) leg.distanceKm = distance;
      legs.push(leg);
    }
    return { legs };
  });

export type PlaceSuggestion = {
  placeId: string;
  name: string;
  secondary: string;
};

export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ input: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const response = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: gatewayHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input: data.input,
        languageCode: "zh-TW",
        regionCode: "TW",
        includedRegionCodes: ["tw"],
        locationBias: { circle: { center: TAIPEI, radius: BIAS_RADIUS_M } },
      }),
    });
    if (!response.ok) {
      console.error(`Places autocomplete failed [${response.status}]: ${await response.text()}`);
      return { suggestions: [] as PlaceSuggestion[] };
    }
    const payload = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          text?: { text?: string };
        };
      }>;
    };
    const suggestions: PlaceSuggestion[] = [];
    for (const item of payload.suggestions ?? []) {
      const p = item.placePrediction;
      if (!p?.placeId) continue;
      suggestions.push({
        placeId: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      });
    }
    return { suggestions: suggestions.slice(0, 6) };
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ placeId: z.string().min(3).max(400) }).parse(data))
  .handler(async ({ data }) => {
    const response = await fetch(
      `${GATEWAY}/places/v1/places/${encodeURIComponent(data.placeId)}?languageCode=zh-TW&regionCode=TW`,
      {
        headers: gatewayHeaders({
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,location,rating,userRatingCount,primaryTypeDisplayName,googleMapsUri",
        }),
      },
    );
    if (!response.ok) await readError(response, "Place details");
    const place = (await response.json()) as {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      rating?: number;
      userRatingCount?: number;
      primaryTypeDisplayName?: { text?: string };
      googleMapsUri?: string;
    };
    if (!place.location) throw new Error("找不到這個地點的座標");
    const venue: Venue = {
      query: place.displayName?.text ?? "",
      placeId: place.id,
      name: place.displayName?.text ?? "",
      address: place.formattedAddress ?? "",
      lat: place.location.latitude,
      lng: place.location.longitude,
      googleMapsUri:
        place.googleMapsUri ??
        `https://www.google.com/maps/search/?api=1&query_place_id=${place.id}`,
    };
    if (typeof place.rating === "number") venue.rating = place.rating;
    if (typeof place.userRatingCount === "number") venue.ratingCount = place.userRatingCount;
    if (place.primaryTypeDisplayName?.text) venue.category = place.primaryTypeDisplayName.text;
    return { venue };
  });
