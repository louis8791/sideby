import { z } from 'zod';

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
  }),
  budgetTwdTotal: z.number().int().min(0).max(100000),
  transport: z.array(z.enum(['walk', 'transit', 'car', 'bike'])).min(1).max(4)
    .refine(values => new Set(values).size === values.length),
  stops: z.number().int().min(2).max(4),
  outdoorAllowed: z.boolean(),
  bookingAllowed: z.boolean(),
}).superRefine((value, context) => {
  const start = Date.parse(value.startsAt), end = Date.parse(value.endsAt);
  const taipeiDate = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
  if (end <= start || end - start > 16 * 3600000 || taipeiDate(start) !== taipeiDate(end)) {
    context.addIssue({ code: 'custom', message: 'Invalid date window', path: ['endsAt'] });
  }
});
export type SharedConditions = z.infer<typeof sharedConditions>;

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
