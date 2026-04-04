'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Dev-only action to delete a report and all related data.
 * This should NOT be used in production.
 */
export async function deleteReportDev(reportId: string) {
  // Security check: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('This action is only available in development mode.');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  try {
    // 1. Get all match_ids for this report
    const { data: matches, error: fetchError } = await supabase
      .from('matched_services')
      .select('id')
      .eq('report_id', reportId);

    if (fetchError) throw fetchError;
    const matchIds = (matches || []).map(m => m.id);

    // 2. Delete notifications linked to report or matches
    // We use or condition for report_id and match_ids in metadata
    // metadata is jsonb, so we use the @> operator for contains
    if (matchIds.length > 0) {
        await supabase
            .from('notifications')
            .delete()
            .or(`metadata->>report_id.eq.${reportId},metadata->>match_id.in.(${matchIds.join(',')})`);
    } else {
        await supabase
            .from('notifications')
            .delete()
            .eq('metadata->>report_id', reportId);
    }

    // 3. Delete chats associated with these matches
    // Deleting chats will cascade to messages and participants
    if (matchIds.length > 0) {
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .in('match_id', matchIds);
      
      if (chatError) {
        console.error('Error deleting connected chats:', chatError);
        // Continue even if chat deletion fails, as some chats might not have match_id or are already gone
      }
    }

    // 4. Delete the report record
    // This will cascade to matched_services, appointments, etc. (configured in DB)
    const { error: reportDeleteError } = await supabase
      .from('reports')
      .delete()
      .eq('report_id', reportId);

    if (reportDeleteError) throw reportDeleteError;

    revalidatePath('/dashboard/reports');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete report (dev-only):', error);
    return { success: false, error: error.message };
  }
}
