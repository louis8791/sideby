import type { VenueRecord } from '../venues/schema';

export const approvedDatasetVersion = 'sideby-approved-2026-09-06-v1';
export const approvedMatrixVersion = 'sideby-approved-routes-2026-09-06-v1';

const sourceUrl = 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/AttractionList.json';
const licenseUrl = 'https://data.gov.tw/license';
const reviewedAt = '2026-09-06T12:00:00+08:00';

type Schedule = Partial<Record<number, readonly [string, string]>>;
type ApprovedVenue = {
  sourceRecordId: string;
  venueId: string;
  googlePlaceId: string;
  name: string;
  category: VenueRecord['category'];
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  checkedAt: string;
  hours: string;
  priceTwd: number;
  durationMinutes: number;
  bookingStatus: 'not_required' | 'required';
  schedule: Schedule;
};

const daily = (open: string, close: string): Schedule => Object.fromEntries(
  Array.from({ length: 7 }, (_, day) => [day, [open, close]]),
);

const venues: ApprovedVenue[] = [
  {
    sourceRecordId: 'Attraction_A13020000G_000048',
    venueId: 'venue_gov_attraction_a13020000g_000048_2d434fdebe40',
    googlePlaceId: 'ChIJ01fuoqweaDQRuB4-gTc5TmY', name: '許新旺陶瓷紀念博物館', category: 'cultural',
    address: '新北市鶯歌區尖山埔路81號', district: '鶯歌區', latitude: 24.9509574576297, longitude: 121.347689626984,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 0, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '週三 13:00–18:00；週四至週日 10:00–18:00；週一、週二公休',
    schedule: { 0: ['10:00', '18:00'], 3: ['13:00', '18:00'], 4: ['10:00', '18:00'], 5: ['10:00', '18:00'], 6: ['10:00', '18:00'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000054',
    venueId: 'venue_gov_attraction_a13020000g_000054_a4037127451d',
    googlePlaceId: 'ChIJ1TXpWMICaDQRwDyaYsuHArs', name: '手信坊創意和菓子文化館', category: 'workshop',
    address: '新北市土城區國際路55號', district: '土城區', latitude: 24.977821, longitude: 121.466603,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 0, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '每日 08:30–17:30', schedule: daily('08:30', '17:30'),
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000055',
    venueId: 'venue_gov_attraction_a13020000g_000055_ee2f727c52e4',
    googlePlaceId: 'ChIJ08ZubbACaDQRO6F7qUbTHn4', name: '玉美人孕婦裝觀光工廠', category: 'exhibition',
    address: '新北市板橋區四川路二段16巷10號5樓', district: '板橋區', latitude: 24.997297, longitude: 121.456266,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 100, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '週二至週六 10:00–17:30；週日、週一與國定例假日休館',
    schedule: { 2: ['10:00', '17:30'], 3: ['10:00', '17:30'], 4: ['10:00', '17:30'], 5: ['10:00', '17:30'], 6: ['10:00', '17:30'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000061',
    venueId: 'venue_gov_attraction_a13020000g_000061_d1b30a31cdab',
    googlePlaceId: 'ChIJUz24OCWmQjQR7R6HIFuCM3o', name: '維格餅家鳳梨酥夢工場', category: 'workshop',
    address: '新北市五股區成泰路一段87號', district: '五股區', latitude: 25.068739, longitude: 121.435211,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 80, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '每日 08:30–17:30', schedule: daily('08:30', '17:30'),
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000064',
    venueId: 'venue_gov_attraction_a13020000g_000064_19829df89972',
    googlePlaceId: 'ChIJwQK_IlimQjQRQLcK67NrdI8', name: '吳福洋襪子故事館', category: 'exhibition',
    address: '新北市林口區工二工業區工九路3號', district: '林口區', latitude: 25.075814, longitude: 121.401296,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 100, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '每日 09:30–17:30；國定假日照常開放', schedule: daily('09:30', '17:30'),
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000097',
    venueId: 'venue_gov_attraction_a13020000g_000097_3741867db2ec',
    googlePlaceId: 'ChIJaeQ6M8AcaDQRER5VgSV_eyY', name: '王鼎時間科藝體驗館', category: 'exhibition',
    address: '新北市土城區大暖路136號', district: '土城區', latitude: 24.95585, longitude: 121.42359,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 100, durationMinutes: 90, bookingStatus: 'required',
    hours: '每日 09:00–17:00；導覽採預約制', schedule: daily('09:00', '17:00'),
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000175',
    venueId: 'venue_gov_attraction_a13020000g_000175_6f3fb721cf76',
    googlePlaceId: 'ChIJRdM2xoGnQjQRPL5LRABMAYs', name: '王子創意文具國', category: 'workshop',
    address: '新北市林口區粉寮路一段86號', district: '林口區', latitude: 25.0809347421479, longitude: 121.398118659088,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 200, durationMinutes: 75, bookingStatus: 'not_required',
    hours: '週一至週五 09:30–17:30；週六、週日及例假日 09:30–18:00',
    schedule: { ...daily('09:30', '17:30'), 0: ['09:30', '18:00'], 6: ['09:30', '18:00'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000177',
    venueId: 'venue_gov_attraction_a13020000g_000177_3a0d2e935887',
    googlePlaceId: 'ChIJxTDtRAEdaDQR_19jk7DTC-k', name: '聖瑪莉丹麥麵包莊園', category: 'cafe',
    address: '新北市土城區中山路21號', district: '土城區', latitude: 24.96296, longitude: 121.41801,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 150, durationMinutes: 60, bookingStatus: 'not_required',
    hours: '二至四樓展區與 DIY 週六、週日 09:30–18:00', schedule: { 0: ['09:30', '18:00'], 6: ['09:30', '18:00'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000196',
    venueId: 'venue_gov_attraction_a13020000g_000196_ce4d599db0c8',
    googlePlaceId: 'ChIJX_uo67ilQjQRG_AfmSnkGVw', name: '卡滋爆米花觀光工廠樂園', category: 'entertainment',
    address: '新北市八里區觀海大道171號', district: '八里區', latitude: 25.16183, longitude: 121.42265,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 250, durationMinutes: 90, bookingStatus: 'not_required',
    hours: '平日 10:30–17:30；週六、週日及國定假日 10:30–18:30；週二休館',
    schedule: { 0: ['10:30', '18:30'], 1: ['10:30', '17:30'], 3: ['10:30', '17:30'], 4: ['10:30', '17:30'], 5: ['10:30', '17:30'], 6: ['10:30', '18:30'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000201',
    venueId: 'venue_gov_attraction_a13020000g_000201_8e60f6687536',
    googlePlaceId: 'ChIJg0ubPBpTXTQRMa3uFsB6NRE', name: '香帥蛋糕芋製所', category: 'cafe',
    address: '新北市汐止區汐萬路一段211巷26號', district: '汐止區', latitude: 25.0719, longitude: 121.65117,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 0, durationMinutes: 45, bookingStatus: 'not_required',
    hours: '週二至週日 09:30–17:30；週一休館',
    schedule: { 0: ['09:30', '17:30'], 2: ['09:30', '17:30'], 3: ['09:30', '17:30'], 4: ['09:30', '17:30'], 5: ['09:30', '17:30'], 6: ['09:30', '17:30'] },
  },
  {
    sourceRecordId: 'Attraction_A13020000G_000209',
    venueId: 'venue_gov_attraction_a13020000g_000209_5756f56c7ed2',
    googlePlaceId: 'ChIJjV4h5jSpQjQROkFHdS2RHsU', name: '啤酒頭釀造觀光酒廠', category: 'workshop',
    address: '新北市三重區中興北街50號', district: '三重區', latitude: 25.05054, longitude: 121.46913,
    checkedAt: '2026-03-25T11:34:20+08:00', priceTwd: 200, durationMinutes: 75, bookingStatus: 'required',
    hours: '週一至週四 13:00–20:00；週五 13:00–21:00；參訪導覽採預約制',
    schedule: { 1: ['13:00', '20:00'], 2: ['13:00', '20:00'], 3: ['13:00', '20:00'], 4: ['13:00', '20:00'], 5: ['13:00', '21:00'] },
  },
  {
    sourceRecordId: 'Attraction_A25000000E_000100',
    venueId: 'venue_gov_attraction_a25000000e_000100_c072a278550e',
    googlePlaceId: 'ChIJG28g82ypQjQRUxV0pGWRxGs', name: '日星鑄字行', category: 'cultural',
    address: '臺北市大同區太原路97弄13號1樓', district: '大同區', latitude: 25.05218, longitude: 121.51638,
    checkedAt: '2026-03-06T11:53:48+08:00', priceTwd: 0, durationMinutes: 45, bookingStatus: 'not_required',
    hours: '週三、週五、週六 10:00–17:00', schedule: { 3: ['10:00', '17:00'], 5: ['10:00', '17:00'], 6: ['10:00', '17:00'] },
  },
  {
    sourceRecordId: 'Attraction_A15011300H_000009',
    venueId: 'venue_gov_attraction_a15011300h_000009_1061d7d33ad5',
    googlePlaceId: 'ChIJN4LHTVRcXTQRtfLVc5iW2DI', name: '福隆遊客中心', category: 'cultural',
    address: '新北市貢寮區福隆里興隆街36號', district: '貢寮區', latitude: 25.01692, longitude: 121.9425,
    checkedAt: '2026-09-04T23:10:07+08:00', priceTwd: 0, durationMinutes: 45, bookingStatus: 'not_required',
    hours: '每日 09:00–17:00', schedule: daily('09:00', '17:00'),
  },
];

function evidenceId(venue: ApprovedVenue) {
  return `evidence_approved_${venue.sourceRecordId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

export function approvedRecords(): VenueRecord[] {
  return venues.map(venue => {
    const evidence = evidenceId(venue);
    return {
      schemaVersion: '1.0', datasetVersion: approvedDatasetVersion, dataOwner: '交通部觀光署／Sideby',
      venueId: venue.venueId, google_place_id: venue.googlePlaceId, name: venue.name, category: venue.category,
      location: { address: venue.address, district: venue.district, latitude: venue.latitude, longitude: venue.longitude },
      facts: {
        description: '交通部觀光署開放資料候選，經 Sideby Owner 核准進入首批正式推薦。Google 詳情只在畫面即時取得。',
        phone: null, website: null,
        price: { status: 'verified_current', minTwd: venue.priceTwd, maxTwd: venue.priceTwd, basis: 'person', evidenceRefs: [evidence] },
        openingHours: { status: 'verified_current', rawText: venue.hours, evidenceRefs: [evidence] },
        facilities: ['室內參觀區', '冷氣狀態未核對'],
      },
      sources: [{
        evidenceId: evidence, sourceType: 'government_open_data', sourceName: '交通部觀光署觀光資訊資料庫',
        sourceUrl, sourceRecordId: venue.sourceRecordId, checkedAt: venue.checkedAt, observedAt: null,
        licenseName: '政府資料開放授權條款-第1版', licenseUrl, rightsStatus: 'open_license_verified',
        allowInRag: false, evidenceSummary: `官方資料記載票價每人 ${venue.priceTwd} 元；營業資訊：${venue.hours}`,
      }],
      attributes: [],
      review: { status: 'approved', reviewedBy: 'Sideby Owner', reviewedAt },
    };
  });
}

function taipeiIso(date: string, time: string) {
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

function slotId(date: string, index: number) {
  return `41000000-0000-4000-8000-${date.replaceAll('-', '')}${String(index + 1).padStart(4, '0')}`;
}

export function approvedExecutionSlots(startDate: string, dayCount = 1) {
  const slots: Array<{
    slotId: string; venueId: string; opensAt: string; closesAt: string; durationMinutes: number;
    outdoor: false; weatherStatus: 'not_applicable'; areaName: string; airConditioned: null;
    bookingStatus: 'not_required' | 'required'; transportModes: readonly ['bus', 'car', 'scooter'];
    dietarySupport: string[]; allergenStatus: 'unknown'; allergensPresent: string[];
    accessibilitySupport: string[]; minimumAge: null; sourceCheckedAt: string;
    status: 'verified_current'; sponsored: false;
  }> = [];
  const start = new Date(`${startDate}T12:00:00+08:00`);
  for (let offset = 0; offset < dayCount; offset += 1) {
    const day = new Date(start.valueOf() + offset * 86_400_000);
    const date = new Date(day.valueOf() + 8 * 3_600_000).toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    venues.forEach((venue, index) => {
      const hours = venue.schedule[weekday];
      if (!hours) return;
      slots.push({
        slotId: slotId(date, index), venueId: venue.venueId,
        opensAt: taipeiIso(date, hours[0]), closesAt: taipeiIso(date, hours[1]), durationMinutes: venue.durationMinutes,
        outdoor: false, weatherStatus: 'not_applicable' as const, areaName: '室內參觀區', airConditioned: null,
        bookingStatus: venue.bookingStatus, transportModes: ['bus', 'car', 'scooter'] as const,
        dietarySupport: [], allergenStatus: 'unknown' as const, allergensPresent: [], accessibilitySupport: [],
        minimumAge: null, sourceCheckedAt: venue.checkedAt, status: 'verified_current' as const, sponsored: false,
      });
    });
  }
  return slots;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude), lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function minutes(km: number, speedKmh: number, fixed: number) {
  return Math.min(240, Math.max(1, Math.ceil(km / speedKmh * 60 + fixed)));
}

type LocatedVenue = { venueId: string; latitude: number; longitude: number };
function travelLegs(fromKey: string, from: { latitude: number; longitude: number }, targets: LocatedVenue[], matrixVersion = approvedMatrixVersion) {
  return targets.flatMap(to => {
    const km = distanceKm(from, to);
    return [
      { matrixVersion, fromKey, toKey: to.venueId, mode: 'bus' as const, minutes: minutes(km, 22, 8) },
      { matrixVersion, fromKey, toKey: to.venueId, mode: 'car' as const, minutes: minutes(km, 35, 5) },
      { matrixVersion, fromKey, toKey: to.venueId, mode: 'scooter' as const, minutes: minutes(km, 30, 5) },
    ];
  });
}

export function approvedTravelLegs() {
  return venues.flatMap(from => travelLegs(from.venueId, from, venues.filter(to => to.venueId !== from.venueId)));
}

export function approvedMeetingLegs(matrixKey: string, point: { latitude: number; longitude: number }, records?: VenueRecord[]) {
  return travelLegs(matrixKey, point, records ? records.map(record => ({ venueId: record.venueId, ...record.location })) : venues);
}

export function estimatedDatasetLegs(records: VenueRecord[], matrixVersion: string, neighborLimit = Number.POSITIVE_INFINITY) {
  const targets = records.map(record => ({ venueId: record.venueId, ...record.location }));
  return targets.flatMap(from => travelLegs(from.venueId, from, targets.filter(to => to.venueId !== from.venueId)
    .sort((a, b) => distanceKm(from, a) - distanceKm(from, b)).slice(0, neighborLimit), matrixVersion));
}

export function approvedSourceRecordIds() {
  return venues.map(venue => venue.sourceRecordId);
}
