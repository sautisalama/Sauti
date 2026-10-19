'use server';

import { guard } from '@/lib/action-result';
import { requireModule } from '@/lib/access/permissions';
import { loadEngagement, type Engagement } from '@/lib/mjengo/engagement-core';

/** How the organisation's own posts are doing on the networks it has connected (see lib/mjengo/engagement-core.ts). */
export type { EngagedPost, ChannelEngagement, Engagement } from '@/lib/mjengo/engagement-core';

async function engagement_(): Promise<Engagement> {
  await requireModule('design');
  return loadEngagement();
}

export const getEngagement = guard(engagement_);
