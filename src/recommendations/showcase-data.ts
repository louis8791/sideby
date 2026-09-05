import type { VenueAttribute, VenueRecord } from '../venues/schema';

export const showcaseDatasetVersion = 'sideby-showcase-2026-09-05-v1';
export const showcaseMatrixVersion = 'sideby-showcase-routes-2026-09-05-v1';

type ShowcaseVenue = {
  id: string;
  name: string;
  category: VenueRecord['category'];
  district: string;
  googlePlaceId: string;
  cost: number;
  duration: number;
  latitude: number;
  longitude: number;
  attributes: Partial<Record<VenueAttribute, number>>;
  outdoor?: boolean;
  outdoorArea?: string;
};

const reviewedAt = '2026-09-05T15:20:00+08:00';

const venues: ShowcaseVenue[] = [
  { id: 'fika_fika', name: 'Fika Fika Cafe', category: 'cafe', district: '中山區',
    googlePlaceId: 'ChIJEfselmGpQjQR7yaK-dqDBJ4', cost: 520, duration: 65,
    latitude: 25.05, longitude: 121.535,
    attributes: { bright: .9, quiet: .68, relaxing: .82, romantic: .55 }, outdoorArea: '戶外座位（展示設定）' },
  { id: 'moca_taipei', name: '臺北當代藝術館', category: 'exhibition', district: '大同區',
    googlePlaceId: 'ChIJc-TxSWypQjQR-8Eh7elK97Q', cost: 600, duration: 70,
    latitude: 25.051, longitude: 121.519,
    attributes: { bright: .72, formal: .62, interactive: .78, freshness: .9 }, outdoorArea: '戶外廣場（展示設定）' },
  { id: 'shinye_shuangcheng', name: '欣葉台菜創始店', category: 'restaurant', district: '中山區',
    googlePlaceId: 'ChIJbamMQUWpQjQRiFWnBTPPj_Y', cost: 730, duration: 50,
    latitude: 25.066, longitude: 121.524,
    attributes: { formal: .65, relaxing: .55, food_variety: .9 } },
  { id: 'rixing_type_foundry', name: '日星鑄字行', category: 'workshop', district: '大同區',
    googlePlaceId: 'ChIJG28g82ypQjQRUxV0pGWRxGs', cost: 1000, duration: 90,
    latitude: 25.052, longitude: 121.516,
    attributes: { cute: .68, interactive: .96, freshness: .92 } },
  { id: 'miss_v_chifeng', name: 'Miss V Bakery Cafe 赤峰店', category: 'cafe', district: '大同區',
    googlePlaceId: 'ChIJz5YRhGmpQjQRQ0ToCtyK2QM', cost: 480, duration: 45,
    latitude: 25.056, longitude: 121.52,
    attributes: { bright: .82, cute: .9, relaxing: .68 } },
  { id: 'chifeng_street', name: '赤峰街', category: 'walk', district: '大同區',
    googlePlaceId: 'ChIJTZ-x02upQjQR-DecmBEnFcw', cost: 600, duration: 40,
    latitude: 25.055, longitude: 121.52,
    attributes: { walking: .92, relaxing: .7, freshness: .7 }, outdoor: true },
  { id: 'coffee_stand_by_me', name: 'Coffee Stand by me', category: 'cafe', district: '大同區',
    googlePlaceId: 'ChIJj9ZKemmpQjQREzU75aHewYU', cost: 560, duration: 80,
    latitude: 25.055, longitude: 121.52,
    attributes: { bright: .72, quiet: .76, relaxing: .92 } },
  { id: 'expo_yuanshan_park', name: '花博公園圓山園區', category: 'park', district: '中山區',
    googlePlaceId: 'ChIJsQbu8U6pQjQRcRFVHKrhSfE', cost: 0, duration: 35,
    latitude: 25.072, longitude: 121.522,
    attributes: { walking: .9, romantic: .72, relaxing: .94 }, outdoor: true },
  { id: 'shuanglian_tangyuan', name: '雙連圓仔湯', category: 'restaurant', district: '大同區',
    googlePlaceId: 'ChIJKxs5EWqpQjQR5YY6i_OYQfE', cost: 1000, duration: 55,
    latitude: 25.057, longitude: 121.519,
    attributes: { food_variety: .72, relaxing: .62, freshness: .55 } },
];

function record(venue: ShowcaseVenue): VenueRecord {
  const evidenceId = `evidence_showcase_${venue.id}`;
  return {
    schemaVersion: '1.0', datasetVersion: showcaseDatasetVersion, dataOwner: 'Sideby hackathon team',
    venueId: `venue_showcase_${venue.id}`, google_place_id: venue.googlePlaceId,
    name: venue.name, category: venue.category,
    location: {
      address: `臺北市${venue.district}（展示定位；實際位置由 Google Place ID 即時載入）`,
      district: venue.district, latitude: venue.latitude, longitude: venue.longitude,
    },
    facts: {
      description: '團隊既有三套約會路線的黑客松展示站點；時間、價格與屬性為展示設定。',
      phone: null, website: null,
      price: { status: 'verified_current', minTwd: venue.cost, maxTwd: venue.cost, basis: 'couple', evidenceRefs: [evidenceId] },
      openingHours: { status: 'verified_current', rawText: '黑客松展示時段 10:00–23:59；不是即時營業資訊。', evidenceRefs: [evidenceId] },
      facilities: [],
    },
    sources: [{
      evidenceId, sourceType: 'team_observation', sourceName: 'Sideby frontend showcase plans',
      sourceUrl: null, sourceRecordId: `frontend-plan-${venue.id}`, checkedAt: reviewedAt, observedAt: reviewedAt,
      licenseName: null, licenseUrl: null, rightsStatus: 'owned', allowInRag: false,
      evidenceSummary: '名稱、順序、展示價格與時長由團隊既有前端方案提供；Google 僅以 Place ID 即時顯示，不保存評論、照片、評分、地址或路線回應。',
    }],
    attributes: Object.entries(venue.attributes).map(([attribute, value]) => ({
      attribute: attribute as VenueAttribute, value: value!, scaleVersion: 'showcase-demo-v1',
      evidenceQuality: 'medium', uncertainty: '僅供黑客松展示，不代表真實世界長期評測。',
      scope: 'general', context: null, status: 'approved', evidenceRefs: [evidenceId],
      reviewedBy: 'Sideby hackathon team', reviewedAt,
    })),
    review: { status: 'approved', reviewedBy: 'Sideby hackathon team', reviewedAt },
  };
}

export function showcaseRecords() {
  return venues.map(record);
}

export function showcaseExecutionSlots(taipeiDate: string) {
  const base = venues.map((venue, index) => ({
    slotId: `31000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    venueId: `venue_showcase_${venue.id}`,
    opensAt: `${taipeiDate}T00:00:00Z`, closesAt: `${taipeiDate}T15:59:00Z`,
    durationMinutes: venue.duration, outdoor: venue.outdoor ?? false,
    weatherStatus: venue.outdoor ? 'verified_suitable' as const : 'not_applicable' as const,
    areaName: venue.outdoor ? '戶外區（展示設定）' : '室內區（展示設定）',
    airConditioned: venue.outdoor ? false : true,
    bookingStatus: 'not_required' as const, transportModes: ['metro', 'walk'] as const,
    dietarySupport: [], allergenStatus: 'verified_current' as const, allergensPresent: [],
    accessibilitySupport: [], minimumAge: null, sourceCheckedAt: reviewedAt,
    status: 'verified_current' as const, sponsored: false,
  }));
  const outdoorAlternatives = venues.flatMap((venue, index) => venue.outdoorArea ? [{
    ...base[index]!, slotId: `32000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    outdoor: true, weatherStatus: 'verified_suitable' as const, areaName: venue.outdoorArea,
    airConditioned: false,
  }] : []);
  return [...base, ...outdoorAlternatives];
}

export function showcaseTravelLegs() {
  const tierOne = ['fika_fika', 'rixing_type_foundry', 'coffee_stand_by_me'];
  const tierTwo = ['moca_taipei', 'miss_v_chifeng', 'expo_yuanshan_park'];
  const tierThree = ['shinye_shuangcheng', 'chifeng_street', 'shuanglian_tangyuan'];
  const id = (slug: string) => `venue_showcase_${slug}`;
  const legs = ['meeting_user', 'meeting_test'].flatMap((origin, originIndex) => tierOne.map((to, index) => ({
    matrixVersion: showcaseMatrixVersion, fromKey: origin, toKey: id(to), mode: 'metro' as const,
    minutes: [10, 20, 15][index]! + originIndex,
  })));
  for (const [fromIndex, from] of tierOne.entries()) for (const [toIndex, to] of tierTwo.entries()) legs.push({
    matrixVersion: showcaseMatrixVersion, fromKey: id(from), toKey: id(to), mode: 'metro',
    minutes: 10 + Math.abs(fromIndex - toIndex) * 4,
  });
  for (const [fromIndex, from] of tierTwo.entries()) for (const [toIndex, to] of tierThree.entries()) legs.push({
    matrixVersion: showcaseMatrixVersion, fromKey: id(from), toKey: id(to), mode: 'metro',
    minutes: 10 + Math.abs(fromIndex - toIndex) * 5,
  });
  return legs;
}
