'use server';

import { createClient } from "@/utils/supabase/server";
import { sendNotification } from "@/lib/notifications";
import { 
    serviceVerifiedEmail, 
    serviceRejectedEmail,
    profileVerifiedEmail,
    profileRejectedEmail
} from "@/lib/notifications/templates";
import { revalidatePath } from "next/cache";

export type AdminActionParams = {
    targetId: string;
    targetType: 'profile' | 'service';
    action: 'verify' | 'reject' | 'ban';
    notes?: string;
};

export async function performAdminAction({ targetId, targetType, action, notes }: AdminActionParams) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Determine status
    const status = action === 'verify' ? 'verified' : (action === 'ban' ? 'suspended' : 'rejected');

    // 1. Update Target Status
    const updatePayload: any = {
        verification_status: status,
        verification_notes: notes,
        verification_updated_at: new Date().toISOString(),
        ...(action === 'verify' && targetType === 'profile' ? { 
            isVerified: true,
            admin_verified_by: user.id,
            admin_verified_at: new Date().toISOString()
        } : {}),
        reviewed_by: {
            reviewer_id: user.id,
            reviewed_at: new Date().toISOString(),
            action: action,
            notes: notes
        }
    };

    const table = targetType === 'profile' ? 'profiles' : 'support_services';
    const { error: updateError, data: updatedItem } = await supabase
        .from(table)
        .update(updatePayload)
        .eq('id', targetId)
        .select('*') // Need data for notification
        .single();

    if (updateError) throw new Error(updateError.message);

    // 2. Fetch Owner/User for Notification
    let ownerId = targetType === 'profile' ? targetId : updatedItem.user_id;
    let ownerName = "";
    if (targetType === 'profile') {
        ownerName = updatedItem.first_name;
    } else {
        // If service, fetch owner name just in case needed, or rely on service name
        // Notifications service will fetch user profile for email
    }

    // 3. Log Action
    await supabase.from('admin_actions').insert({
        admin_id: user.id,
        action_type: `${action}_${targetType}`,
        target_id: targetId,
        target_type: targetType === 'profile' ? 'user' : 'service',
        details: { notes, previous_status: 'unknown' } // Simplified logging for now
    });

    // 4. Send Notification
    const notificationTitle = targetType === 'profile' 
        ? "Profile Verification Update"
        : "Service Verification Update";
    
    // Construct simplified message for In-App
    const notificationMessage = targetType === 'profile' 
        ? `Your profile verification status has been updated to ${status}.`
        : `Your service "${updatedItem.name}" verification status has been updated to ${status}.`;

    const notificationLink = targetType === 'profile' 
        ? '/dashboard/profile?section=account'
        : '/dashboard/profile?section=services';

    // Generate HTML Template
    let htmlContent = "";
    if (targetType === 'profile') {
        if (action === 'verify') htmlContent = profileVerifiedEmail(updatedItem.first_name || 'Professional');
        if (action === 'reject') htmlContent = profileRejectedEmail(updatedItem.first_name || 'Professional', notes || 'No specific feedback provided.');
    } else {
        if (action === 'verify') htmlContent = serviceVerifiedEmail(updatedItem.name);
        if (action === 'reject') htmlContent = serviceRejectedEmail(updatedItem.name, notes || 'No specific feedback provided.');
    }

    if (ownerId && (action === 'verify' || action === 'reject')) {
        await sendNotification({
            userId: ownerId,
            type: status === 'verified' ? 'verification_verified' : 'verification_rejected',
            title: notificationTitle,
            message: notificationMessage,
            link: notificationLink,
            metadata: { 
                target_type: targetType, 
                target_id: targetId,
                notes: notes,
                action_by: user.id
            },
            sendEmail: true,
            emailHtml: htmlContent
        });
    }

    revalidatePath('/dashboard/admin');
    return { success: true };
}
