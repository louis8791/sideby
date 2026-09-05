import { venueAttributes, venueRecordSchema, type VenueRecord } from './schema';

const reusableRights = new Set(['open_license_verified', 'owned', 'permission_recorded']);
const googleHosts = /(^|\.)(google\.[a-z.]+|googleapis\.com|googleusercontent\.com|gstatic\.com|goo\.gl)$/i;
const subjectiveAttributes = new Set([
  'bright', 'quiet', 'cute', 'childish', 'romantic', 'formal',
  'interactive', 'relaxing', 'freshness',
]);

export interface VenueAssessment {
  valid: boolean;
  errors: string[];
  itineraryEligible: boolean;
  approvedAttributes: VenueRecord['attributes'];
  unknownAttributes: string[];
  ragDocument: string | null;
}

function isGoogleUrl(value: string | null): boolean {
  if (!value) return false;
  try { return googleHosts.test(new URL(value).hostname); }
  catch { return true; }
}

/** Single policy gate used before a venue can be published, ranked, or indexed. */
export function assessVenue(input: unknown): VenueAssessment {
  const parsed = venueRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
      itineraryEligible: false,
      approvedAttributes: [],
      unknownAttributes: [...venueAttributes],
      ragDocument: null,
    };
  }

  const venue = parsed.data;
  const errors: string[] = [];
  const evidenceById = new Map<string, VenueRecord['sources'][number]>();
  for (const source of venue.sources) {
    if (evidenceById.has(source.evidenceId)) errors.push(`duplicate evidenceId: ${source.evidenceId}`);
    evidenceById.set(source.evidenceId, source);
    if (isGoogleUrl(source.sourceUrl)) errors.push(`Google-derived source is prohibited: ${source.evidenceId}`);
    if (source.allowInRag && !reusableRights.has(source.rightsStatus)) {
      errors.push(`RAG use lacks reusable rights: ${source.evidenceId}`);
    }
    if (source.rightsStatus === 'open_license_verified' && (!source.licenseName || !source.licenseUrl)) {
      errors.push(`verified open license lacks name or URL: ${source.evidenceId}`);
    }
    if (source.sourceType === 'consented_feedback'
      && (source.allowInRag || source.rightsStatus !== 'permission_recorded' || !source.sourceRecordId)) {
      errors.push(`personal feedback requires a consent record and cannot enter shared RAG: ${source.evidenceId}`);
    }
  }

  for (const fact of [venue.facts.price, venue.facts.openingHours]) {
    for (const ref of fact.evidenceRefs) {
      if (!evidenceById.has(ref)) errors.push(`fact references missing evidence: ${ref}`);
    }
  }
  if (venue.facts.price.minTwd !== null && venue.facts.price.maxTwd !== null && venue.facts.price.minTwd > venue.facts.price.maxTwd) {
    errors.push('price minTwd cannot exceed maxTwd');
  }
  if (venue.facts.price.status === 'verified_current' && (venue.facts.price.minTwd === null || venue.facts.price.maxTwd === null || venue.facts.price.evidenceRefs.length === 0)) {
    errors.push('verified_current price requires values and evidence');
  }
  if (venue.facts.price.status === 'verified_current' && venue.facts.price.basis === 'unknown') {
    errors.push('verified_current price requires a known basis');
  }
  if (venue.facts.openingHours.status === 'verified_current' && (!venue.facts.openingHours.rawText || venue.facts.openingHours.evidenceRefs.length === 0)) {
    errors.push('verified_current opening hours require text and evidence');
  }

  const approvedAttributes: VenueRecord['attributes'] = [];
  const knownAttributes = new Set<string>();
  for (const observation of venue.attributes) {
    const sources = observation.evidenceRefs.map(ref => evidenceById.get(ref));
    if (sources.some(source => !source)) errors.push(`attribute references missing evidence: ${observation.attribute}`);
    if (observation.scope === 'contextual' && !observation.context) {
      errors.push(`contextual attribute lacks context: ${observation.attribute}`);
    }
    if (observation.status === 'approved') {
      if (observation.value === null || observation.evidenceRefs.length === 0 || !observation.reviewedBy || !observation.reviewedAt) {
        errors.push(`approved attribute lacks value, evidence, or review: ${observation.attribute}`);
        continue;
      }
      if (observation.scope === 'personal' || sources.every(source => source?.sourceType === 'consented_feedback')) {
        continue;
      }
      if (subjectiveAttributes.has(observation.attribute)
        && !sources.some(source => source?.sourceType === 'team_observation' || source?.sourceType === 'owned_photo')) {
        errors.push(`subjective attribute lacks direct observation evidence: ${observation.attribute}`);
        continue;
      }
      approvedAttributes.push(observation);
      knownAttributes.add(observation.attribute);
    }
  }

  if (venue.review.status === 'approved' && (!venue.review.reviewedBy || !venue.review.reviewedAt)) {
    errors.push('approved venue requires reviewer and review time');
  }

  const valid = errors.length === 0;
  const itineraryEligible = valid
    && venue.review.status === 'approved'
    && venue.facts.price.status === 'verified_current'
    && venue.facts.openingHours.status === 'verified_current';

  let ragDocument: string | null = null;
  if (valid && venue.review.status === 'approved') {
    const reusableSources = venue.sources.filter(source => source.allowInRag && reusableRights.has(source.rightsStatus) && source.sourceType !== 'consented_feedback');
    if (reusableSources.length > 0) {
      const attributes = approvedAttributes.map(item => {
        const context = item.context
          ? ` (${item.context.dayType}/${item.context.timeOfDay}/${item.context.area ?? '未指定區域'})`
          : '';
        return `${item.attribute}=${item.value}${context}`;
      }).join(', ') || '無已核准主觀屬性';
      ragDocument = [
        `venue_id: ${venue.venueId}`,
        `名稱: ${venue.name}`,
        `類別: ${venue.category}`,
        `地區: ${venue.location.district}`,
        `已核准屬性: ${attributes}`,
        ...reusableSources.map(source => `可重用來源摘要: ${source.evidenceSummary}`),
      ].join('\n');
    }
  }

  return {
    valid,
    errors,
    itineraryEligible,
    approvedAttributes: valid ? approvedAttributes : [],
    unknownAttributes: valid ? venueAttributes.filter(attribute => !knownAttributes.has(attribute)) : [...venueAttributes],
    ragDocument,
  };
}
