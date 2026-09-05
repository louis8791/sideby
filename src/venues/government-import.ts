import { z } from 'zod';
import { createHash } from 'node:crypto';
import { venueCategories, type VenueRecord } from './schema';

export const governmentSourceRowSchema = z.strictObject({
  datasetVersion: z.string().trim().min(1),
  datasetName: z.string().trim().min(1),
  datasetUrl: z.url(),
  dataOwner: z.string().trim().min(1),
  licenseName: z.string().trim().min(1).nullable(),
  licenseUrl: z.url().nullable(),
  recordId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  district: z.string().trim().min(1),
  latitude: z.number().min(24.6).max(25.4),
  longitude: z.number().min(121.2).max(122.1),
  category: z.enum(venueCategories),
  description: z.string().trim().min(1).nullable(),
  phone: z.string().trim().min(1).nullable(),
  website: z.url().nullable(),
  openingHours: z.string().trim().min(1).nullable(),
  checkedAt: z.iso.datetime({ offset: true }),
  licenseVerified: z.boolean(),
  descriptionReuseAllowed: z.boolean(),
}).superRefine((row, context) => {
  if (row.licenseVerified && (!row.licenseName || !row.licenseUrl)) {
    context.addIssue({ code: 'custom', path: ['licenseVerified'], message: 'Verified license requires name and URL' });
  }
  if (row.descriptionReuseAllowed && !row.licenseVerified) {
    context.addIssue({ code: 'custom', path: ['descriptionReuseAllowed'], message: 'Description reuse requires a verified license' });
  }
});

export type GovernmentSourceRow = z.infer<typeof governmentSourceRowSchema>;

function stablePart(label: string, identity: string): string {
  const readable = label.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'record';
  const hash = createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, 12);
  return `${readable}_${hash}`;
}

export function importGovernmentRow(input: unknown): VenueRecord {
  const row = governmentSourceRowSchema.parse(input);
  const stableId = stablePart(row.recordId, `${row.datasetUrl}#${row.recordId}`);
  const evidenceId = `evidence_gov_${stableId}`;
  return {
    schemaVersion: '1.0',
    datasetVersion: row.datasetVersion,
    dataOwner: row.dataOwner,
    venueId: `venue_gov_${stableId}`,
    name: row.name,
    category: row.category,
    location: { address: row.address, district: row.district, latitude: row.latitude, longitude: row.longitude },
    facts: {
      description: row.description,
      phone: row.phone,
      website: row.website,
      price: { status: 'unknown', minTwd: null, maxTwd: null, basis: 'unknown', evidenceRefs: [] },
      openingHours: {
        status: row.openingHours ? 'source_reported' : 'unknown',
        rawText: row.openingHours,
        evidenceRefs: row.openingHours ? [evidenceId] : [],
      },
      facilities: [],
    },
    sources: [{
      evidenceId,
      sourceType: 'government_open_data',
      sourceName: row.datasetName,
      sourceUrl: row.datasetUrl,
      sourceRecordId: row.recordId,
      checkedAt: row.checkedAt,
      observedAt: null,
      licenseName: row.licenseName,
      licenseUrl: row.licenseUrl,
      rightsStatus: row.licenseVerified ? 'open_license_verified' : 'pending',
      allowInRag: row.licenseVerified && row.descriptionReuseAllowed,
      evidenceSummary: row.description ?? `政府開放資料記錄：${row.name}`,
    }],
    attributes: [],
    review: { status: 'draft', reviewedBy: null, reviewedAt: null },
  };
}
