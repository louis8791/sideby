import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { assertLocalMapsRequest, autocomplete, geocode, placeDetails, resolveVenueQueries, travelLegs } from "./google-maps.server";
export type { Venue, TravelLeg, PlaceSuggestion } from "./google-maps.server";

const localMaps = createMiddleware({ type: "function" }).server(async ({ next }) => {
  assertLocalMapsRequest(getRequest(), process.env["NODE_ENV"]);
  return next();
});
const point = z.object({ label: z.string().min(1).max(80), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const getMapsConfiguration = createServerFn({ method: "POST" }).middleware([localMaps])
  .handler(async () => ({ serverKeyPresent: Boolean(process.env["GOOGLE_MAPS_SERVER_API_KEY"]?.trim()), liveVerified: false }));

export const resolveVenues = createServerFn({ method: "POST" }).middleware([localMaps])
  .inputValidator((data) => z.object({ queries: z.array(z.string().trim().min(1).max(120)).min(1).max(8) }).parse(data))
  .handler(async ({ data }) => resolveVenueQueries(data.queries));

export const computeTravelLegs = createServerFn({ method: "POST" }).middleware([localMaps])
  .inputValidator((data) => z.object({ points: z.array(point).min(2).max(8) }).parse(data))
  .handler(async ({ data }) => travelLegs(data.points));

export const autocompletePlaces = createServerFn({ method: "POST" }).middleware([localMaps])
  .inputValidator((data) => z.object({ input: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => autocomplete(data.input));

export const getPlaceDetails = createServerFn({ method: "POST" }).middleware([localMaps])
  .inputValidator((data) => z.object({ placeId: z.string().min(3).max(400) }).parse(data))
  .handler(async ({ data }) => placeDetails(data.placeId));

export const geocodeAddress = createServerFn({ method: "POST" }).middleware([localMaps])
  .inputValidator((data) => z.object({ address: z.string().trim().min(2).max(200) }).parse(data))
  .handler(async ({ data }) => geocode(data.address));
