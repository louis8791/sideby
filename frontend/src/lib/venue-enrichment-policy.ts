export function trustedGooglePlaceIds(stops: Array<{ googlePlaceId?: string }>): string[] {
  return [...new Set(stops.flatMap((stop) => stop.googlePlaceId ? [stop.googlePlaceId] : []))];
}
