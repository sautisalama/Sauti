// The verification flow on shared Instagram posts: an aggregator or link hub should lead to the organisation's own link.
//   npx tsx --env-file=.env.local scripts/test-aggregator.mts
import { runVerification } from '../lib/mjengo/opportunity-verify';

const today = new Date().toISOString().slice(0, 10);
for (const url of ['https://www.instagram.com/p/DdqhS46oLCd/?psln=OGJzcWNnOWhuZDU=', 'https://www.instagram.com/p/DeJQiJBis_v/?stkn=cXQ4cW00dXA4cDR6']) {
  const v = await runVerification({ url, text: null, today });
  console.log(JSON.stringify({ url, title: v.title, finalUrl: v.finalUrl, sharedUrl: v.sharedUrl, useFinalLink: v.useFinalLink, viaAggregator: v.viaAggregator, foundBy: v.foundBy, verdict: v.verdict }, null, 1));
}
