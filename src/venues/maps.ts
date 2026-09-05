export function googleMapsUrl(venueName: string, placeId?: string) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', venueName);
  if (placeId) url.searchParams.set('query_place_id', placeId);
  return url.toString();
}
