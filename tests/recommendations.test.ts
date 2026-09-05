import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWithRuleBaseline } from '../src/model/preference-query';
import { composeItineraries, materiallyDifferent, publicItinerarySchema } from '../src/recommendations/engine';
import {
  recommendationLegs, recommendationParserOutputs, recommendationSessionId as sessionId,
  recommendationShared as shared, recommendationSlot, recommendationVenues,
} from './recommendation-fixtures';

const parserOutputs = recommendationParserOutputs();
const venues = recommendationVenues();
const legs = recommendationLegs();

test('composer returns three schema-valid, diverse and hard-valid itineraries', () => {
  const result = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs, now: new Date('2026-09-05T02:00:00Z') });
  assert.equal(result.length, 3);
  for (const itinerary of result) {
    assert.equal(publicItinerarySchema.safeParse(itinerary).success, true);
    assert.equal(itinerary.stops.length, 2);
    assert.ok(itinerary.total_cost <= shared.budgetTwdTotal);
    assert.ok(itinerary.travel_minutes <= shared.maxTotalTravelMinutes!);
    assert.ok(!itinerary.stops.some(stop => stop.venue_id === 'venue_test_8'));
    assert.match(itinerary.public_reason, /^符合共同時間與預算/);
  }
  for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
    assert.equal(materiallyDifferent(result[i], result[j]), true);
  }
});

test('sponsorship never changes CoupleScore', () => {
  const plain = composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs });
  const sponsored = composeItineraries({
    sessionId, version: 3, shared, parserOutputs,
    venues: venues.map((item, index) => ({ ...item, execution: recommendationSlot(index + 1, true) })), legs,
  });
  assert.deepEqual(plain.map(item => item.couple_score), sponsored.map(item => item.couple_score));
  assert.ok(sponsored.every(item => item.sponsored_content));
});

test('missing routes, unresolved input and impossible budget fail closed', () => {
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs, venues, legs: [] }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared: { ...shared, budgetTwdTotal: 1 }, parserOutputs, venues, legs }), []);
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs: [parserOutputs[0]], venues, legs }), []);
  const privateBudget = [
    parseWithRuleBaseline({ sessionId, mode: 'future', visibility: 'private_session', rawText: '每人最多 50 元。' }),
    parserOutputs[1],
  ];
  assert.deepEqual(composeItineraries({ sessionId, version: 3, shared, parserOutputs: privateBudget, venues, legs }), []);
});
