import { z } from 'zod';
import { preferenceAttributes } from '../model/preference-catalog';

export const venueAttributes = preferenceAttributes;

export const venueCategories = [
  'cafe', 'restaurant', 'exhibition', 'workshop', 'park', 'walk',
  'entertainment', 'cultural', 'market', 'other',
] as const;

export const venueId = z.string().regex(/^venue_[a-z0-9_-]{1,120}$/);

const sourceEvidence = z.strictObject({
  evidenceId: z.string().regex(/^evidence_[a-z0-9_-]+$/),
  sourceType: z.enum([
    'government_open_data', 'merchant_official', 'team_observation',
    'owned_photo', 'consented_feedback',
  ]),
  sourceName: z.string().trim().min(1).max(160),
  sourceUrl: z.url().nullable(),
  sourceRecordId: z.string().trim().min(1).max(200).nullable(),
  checkedAt: z.iso.datetime({ offset: true }),
  observedAt: z.iso.datetime({ offset: true }).nullable(),
  licenseName: z.string().trim().min(1).max(200).nullable(),
  licenseUrl: z.url().nullable(),
  rightsStatus: z.enum([
    'open_license_verified', 'owned', 'permission_recorded',
    'reference_only', 'pending',
  ]),
  allowInRag: z.boolean(),
  evidenceSummary: z.string().trim().min(1).max(1000),
});

const factStatus = z.enum(['unknown', 'source_reported', 'verified_current']);

const attributeObservation = z.strictObject({
  attribute: z.enum(venueAttributes),
  value: z.number().min(0).max(1).nullable(),
  scaleVersion: z.string().trim().min(1).max(80),
  evidenceQuality: z.enum(['low', 'medium', 'high']),
  uncertainty: z.string().trim().min(1).max(500).nullable(),
  scope: z.enum(['general', 'contextual', 'personal']),
  context: z.strictObject({
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night', 'unknown']),
    dayType: z.enum(['weekday', 'weekend', 'holiday', 'unknown']),
    area: z.string().trim().min(1).max(120).nullable(),
  }).nullable(),
  status: z.enum(['proposed', 'approved', 'disputed', 'stale', 'unknown']),
  evidenceRefs: z.array(z.string().regex(/^evidence_[a-z0-9_-]+$/)).max(20),
  reviewedBy: z.string().trim().min(1).max(120).nullable(),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const venueRecordSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  datasetVersion: z.string().trim().min(1).max(80),
  dataOwner: z.string().trim().min(1).max(120),
  venueId,
  google_place_id: z.string().regex(/^[A-Za-z0-9_-]{1,300}$/).optional(),
  name: z.string().trim().min(1).max(160),
  category: z.enum(venueCategories),
  location: z.strictObject({
    address: z.string().trim().min(1).max(300),
    district: z.string().trim().min(1).max(80),
    latitude: z.number().min(24.6).max(25.4),
    longitude: z.number().min(121.2).max(122.1),
  }),
  facts: z.strictObject({
    description: z.string().trim().min(1).max(2000).nullable(),
    phone: z.string().trim().min(1).max(60).nullable(),
    website: z.url().nullable(),
    price: z.strictObject({
      status: factStatus,
      minTwd: z.number().int().min(0).max(100000).nullable(),
      maxTwd: z.number().int().min(0).max(100000).nullable(),
      basis: z.enum(['person', 'couple', 'entry', 'unknown']),
      evidenceRefs: z.array(z.string()).max(20),
    }),
    openingHours: z.strictObject({
      status: factStatus,
      rawText: z.string().trim().min(1).max(1000).nullable(),
      evidenceRefs: z.array(z.string()).max(20),
    }),
    facilities: z.array(z.string().trim().min(1).max(100)).max(30),
    admissionText: z.string().trim().min(1).max(2000).nullable().optional(),
  }),
  sources: z.array(sourceEvidence).min(1).max(50),
  attributes: z.array(attributeObservation).max(100),
  review: z.strictObject({
    status: z.enum(['draft', 'approved', 'rejected', 'stale']),
    reviewedBy: z.string().trim().min(1).max(120).nullable(),
    reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  }),
});

export type VenueRecord = z.infer<typeof venueRecordSchema>;
export type VenueAttribute = typeof venueAttributes[number];
