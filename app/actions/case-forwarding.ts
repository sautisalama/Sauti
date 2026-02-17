'use server';

import { createClient } from "@/utils/supabase/server";
import { sendNotification } from "@/lib/notifications";
import { caseForwardedEmail } from "@/lib/notifications/templates";
import { revalidatePath } from "next/cache";

export type ForwardCaseParams = {
  matchId: string;
  fromProfessionalId: string;
  toProfessionalId: string | null;
  toServicePool: boolean;
  includeNotes: boolean;
  includeRecommendations: boolean;
  requiredServices: string[] | null;
  reason: string | null;
  originalMatchDate: string;
  supportHistory: any[] | null;
};

export async function forwardCase(params: ForwardCaseParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // 1. Insert into case_shares
  const { error: insertError } = await supabase
    .from('case_shares')
    .insert({
      match_id: params.matchId,
      from_professional_id: params.fromProfessionalId,
      to_professional_id: params.toProfessionalId,
      to_service_pool: params.toServicePool,
      include_notes: params.includeNotes,
      include_recommendations: params.includeRecommendations,
      required_services: params.requiredServices,
      reason: params.reason,
      original_match_date: params.originalMatchDate,
      support_history: params.supportHistory,
      status: 'pending'
    });

  if (insertError) {
    console.error("Case forward error:", insertError);
    throw new Error(insertError.message);
  }

  // 2. Fetch sender details for notification
  const { data: sender } = await supabase
    .from('profiles')
    .select('first_name, last_name, professional_title')
    .eq('id', params.fromProfessionalId)
    .single();
  
  const senderName = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'A Professional';

  // 3. Send Notification to Recipient Professional (if direct forward)
  if (params.toProfessionalId) {
    await sendNotification({
      userId: params.toProfessionalId,
      type: 'case_forwarded',
      title: 'Case Forwarded',
      message: `${senderName} has forwarded a case to you for review.`,
      link: '/dashboard/cases', // Should link to specific case/share?
      metadata: {
        match_id: params.matchId,
        from_id: params.fromProfessionalId,
        reason: params.reason
      },
      sendEmail: true,
      emailHtml: caseForwardedEmail(senderName)
    });
  }

  revalidatePath('/dashboard/cases');
  return { success: true };
}
