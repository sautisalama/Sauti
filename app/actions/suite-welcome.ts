'use server';

import { getActor } from '@/lib/access/super-admin';
import { looseAdmin } from '@/lib/loose-db';

export interface WelcomeStatus {
  email: string;
  photo: boolean;
  mail: boolean;
  calendar: boolean;
  drive: boolean;
}

/** What an administrator still has to set up before the suite is fully theirs. Null for anyone else. */
export async function suiteWelcomeStatus(): Promise<WelcomeStatus | null> {
  const actor = await getActor();
  if (!actor?.isAdmin) return null;
  const db = looseAdmin();
  const [profile, mail, cal, drive] = await Promise.all([
    db.from('profiles').select('avatar_url').eq('id', actor.id).maybeSingle(),
    db.from('mail_accounts').select('id', { count: 'exact', head: true }).eq('owner_id', actor.id),
    db.from('profile_calendar_tokens').select('user_id', { count: 'exact', head: true }).eq('user_id', actor.id),
    db.from('mjengo_drive_connections').select('owner_id', { count: 'exact', head: true }).eq('owner_id', actor.id),
  ]);
  return {
    email: actor.email,
    photo: !!(profile.data as { avatar_url?: string | null } | null)?.avatar_url,
    mail: !!mail.count,
    calendar: !!cal.count,
    drive: !!drive.count,
  };
}
