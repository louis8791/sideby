import { z } from 'zod';
import { venueId } from '../venues/schema';

export const id = z.uuid();
export const version = z.number().int().min(0).max(2147483646);
export const sharedConditions = z.strictObject({
  mode: z.enum(['now', 'future']),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  meetingPoint: z.strictObject({
    label: z.string().trim().min(1).max(120),
    latitude: z.number().min(24.6).max(25.4),
    longitude: z.number().min(121.2).max(122.1),
    matrixKey: z.string().regex(/^[a-z0-9._-]{1,80}$/).optional(),
  }),
  budgetTwdTotal: z.number().int().min(0).max(100000),
  transport: z.array(z.enum(['walk', 'transit', 'car', 'bike'])).min(1).max(4)
    .refine(values => new Set(values).size === values.length),
  stops: z.number().int().min(2).max(4),
  outdoorAllowed: z.boolean(),
  bookingAllowed: z.boolean(),
  maxLegTravelMinutes: z.number().int().min(0).max(240).optional(),
  maxTotalTravelMinutes: z.number().int().min(0).max(600).optional(),
  dietaryRequirements: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  allergensToAvoid: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  accessibilityRequirements: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  participantMinAge: z.number().int().min(0).max(120).optional(),
  hardNoCategories: z.array(z.enum([
    'cafe', 'restaurant', 'exhibition', 'workshop', 'park', 'walk',
    'entertainment', 'cultural', 'market', 'other',
  ])).max(10).optional(),
}).superRefine((value, context) => {
  const start = Date.parse(value.startsAt), end = Date.parse(value.endsAt);
  const taipeiDate = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
  if (end <= start || end - start > 16 * 3600000 || taipeiDate(start) !== taipeiDate(end)) {
    context.addIssue({ code: 'custom', message: 'Invalid date window', path: ['endsAt'] });
  }
});
export type SharedConditions = z.infer<typeof sharedConditions>;

export const CURRENT_TERMS_VERSION = '2026-09-05-v1';
const plainText = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>\u0000-\u001f\u007f]/u.test(value) && !/(?:https?:\/\/|www\.)/iu.test(value));
const uniqueTags = z.array(plainText(24)).max(8).refine(values => new Set(values).size === values.length);

export const consentUpdate = z.strictObject({
  termsVersion: z.literal(CURRENT_TERMS_VERSION),
  acceptTerms: z.literal(true),
  personalizationEnabled: z.boolean(),
  modelImprovementOptIn: z.boolean(),
});

export const feedbackInput = z.strictObject({
  noteText: plainText(300).nullable(),
  userTags: uniqueTags,
  rating: z.number().int().min(1).max(5).nullable(),
  visitState: z.enum(['saved', 'want_to_go', 'visited']),
});

export const feedbackPatch = z.strictObject({
  noteText: plainText(300).nullable().optional(),
  userTags: uniqueTags.optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  visitState: z.enum(['saved', 'want_to_go', 'visited']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
}).refine(value => Object.keys(value).length > 0);

const privateText = z.string().trim().min(1).max(1000)
  .refine(value => !/[\u0000-\u001f\u007f]/u.test(value));
const privateTags = z.array(z.string().trim().min(1).max(30)
  .refine(value => !/[\u0000-\u001f\u007f]/u.test(value)))
  .max(12).refine(values => new Set(values).size === values.length);

export const privateInput = z.strictObject({
  rawText: privateText,
  tags: privateTags.default([]),
  visibility: z.enum(['private_session', 'private_remembered']).default('private_session'),
});

export const itineraryReaction = z.strictObject({
  version,
  stopId: id.nullable().optional(),
  reaction: z.enum(['like', 'dislike', 'replace']),
}).superRefine((value, context) => {
  if (value.reaction === 'replace' && !value.stopId) {
    context.addIssue({ code: 'custom', message: 'replace requires stopId', path: ['stopId'] });
  }
});

export const finalizeChoice = z.strictObject({ version, itineraryId: id });
export const preferenceFeedback = z.strictObject({
  version,
  stopId: id,
  signal: z.literal('too_dark'),
});

export { venueId };
export type FeedbackInput = z.infer<typeof feedbackInput>;
export type FeedbackPatch = z.infer<typeof feedbackPatch>;
export type PrivateInput = z.infer<typeof privateInput>;
export type ItineraryReaction = z.infer<typeof itineraryReaction>;
export type PreferenceFeedback = z.infer<typeof preferenceFeedback>;

export interface PublicState {
  sessionId: string;
  coupleId: string;
  version: number;
  shared: SharedConditions | null;
  status: 'waiting_partner' | 'editing' | 'ready';
  members: { role: 'A' | 'B'; online: boolean; confirmed: boolean }[];
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
