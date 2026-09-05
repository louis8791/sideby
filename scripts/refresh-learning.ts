import { withLearningTransaction, collectRankingPreferenceCandidates, buildVenueRecommendationIndex } from '../src/server/learning';

void withLearningTransaction(async client => {
  const candidates = await collectRankingPreferenceCandidates(client);
  const active = await client.query("SELECT version FROM venue_datasets WHERE status='active' AND data_mode='approved_dataset'");
  const index = active.rowCount === 1 ? await buildVenueRecommendationIndex(client, `index-${active.rows[0].version}`) : null;
  return { candidates, index };
}).then(result => console.log(JSON.stringify(result))).catch(() => {
  console.error('Learning refresh failed; active publication was preserved.'); process.exitCode = 1;
});
