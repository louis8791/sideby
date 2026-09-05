import { createHash } from 'node:crypto';
import { approvedExecutionSlots, approvedRecords } from '../recommendations/approved-real-data';
import type { ExecutionSlot } from '../recommendations/engine';
import { venueRecordSchema, type VenueRecord } from './schema';

function stableUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const raw = hex.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

export function buildCandidatePoolRelease(staged: unknown[], startDate: string, dayCount = 90) {
  const sourceRecords = staged.map(item => venueRecordSchema.parse(item));
  const sourceVersion = sourceRecords[0]?.datasetVersion;
  if (!sourceVersion || sourceRecords.some(record => record.datasetVersion !== sourceVersion)) {
    throw new Error('ONE_STAGED_DATASET_REQUIRED');
  }
  const releaseVersion = `sideby-release-pool-${startDate.replaceAll('-', '')}-${createHash('sha256').update(sourceVersion).digest('hex').slice(0, 10)}`;
  const verifiedById = new Map(approvedRecords().map(record => [record.venueId, record]));
  const reviewedAt = new Date(`${startDate}T00:00:00+08:00`).toISOString();
  const records: VenueRecord[] = sourceRecords.map(source => {
    const verified = verifiedById.get(source.venueId);
    return verified
      ? { ...verified, datasetVersion: releaseVersion }
      : { ...source, datasetVersion: releaseVersion,
        review: { status: 'approved', reviewedBy: 'Sideby Owner bulk release', reviewedAt } };
  });
  const ids = new Set(records.map(record => record.venueId));
  const verifiedIds = new Set([...verifiedById.keys()].filter(id => ids.has(id)));
  const slots: ExecutionSlot[] = approvedExecutionSlots(startDate, dayCount)
    .filter(slot => verifiedIds.has(slot.venueId))
    .map(slot => ({ ...slot, slotId: stableUuid(`${releaseVersion}:${slot.slotId}`), transportModes: [...slot.transportModes] }));
  const opensAt = new Date(`${startDate}T00:00:00+08:00`).toISOString();
  const closesAt = new Date(Date.parse(opensAt) + dayCount * 86_400_000).toISOString();
  for (const record of records) if (!verifiedIds.has(record.venueId)) slots.push({
    slotId: stableUuid(`${releaseVersion}:${record.venueId}`), venueId: record.venueId,
    opensAt, closesAt, durationMinutes: 60,
    outdoor: null, weatherStatus: 'unknown', areaName: '實際使用區域待確認', airConditioned: null,
    bookingStatus: 'unknown', transportModes: ['walk', 'metro', 'bus', 'scooter', 'car', 'taxi'],
    dietarySupport: [], allergenStatus: 'unknown', allergensPresent: [], accessibilitySupport: [],
    minimumAge: null, sourceCheckedAt: record.sources[0]!.checkedAt, status: 'provisional', sponsored: false,
  });
  return { version: releaseVersion, records, slots,
    verifiedVenueCount: verifiedIds.size, confirmationRequiredVenueCount: records.length - verifiedIds.size };
}
