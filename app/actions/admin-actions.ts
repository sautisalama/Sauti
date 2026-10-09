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
import { after } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { backfillUnmatched } from "@/lib/matching-engine/service";
import { Database } from "@/types/db-schema";

export type AdminActionParams = {
    targetId: string;
    targetType: 'profile' | 'service';
    action: 'verify' | 'reject' | 'ban';
    notes?: string;
};

type DocTarget = 'profile' | 'service';

async function countDocuments(targetType: DocTarget, targetId: string): Promise<number> {
    const db = createAdminClient();
    if (targetType === 'service') {
        const { data } = await db.from('support_services').select('accreditation_files_metadata').eq('id', targetId).maybeSingle();
        const m = data?.accreditation_files_metadata as unknown;
        return Array.isArray(m) ? m.length : 0;
    }
    const { data } = await db.from('profiles').select('accreditation_files_metadata, accreditation_files').eq('id', targetId).maybeSingle();
    const m = data?.accreditation_files_metadata as unknown;
    const f = data?.accreditation_files as unknown;
    return Math.max(Array.isArray(m) ? m.length : 0, Array.isArray(f) ? f.length : 0);
}

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data: actor } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!actor?.is_admin) throw new Error("Forbidden");
    return user;
}

/** True when the profile, or the service, belongs to the acting user. */
async function isOwnTarget(userId: string, targetType: DocTarget, targetId: string): Promise<boolean> {
    if (targetType === 'profile') return targetId === userId;
    const { data } = await createAdminClient().from('support_services').select('user_id').eq('id', targetId).maybeSingle();
    return data?.user_id === userId;
}

/** Ask a professional/NGO (or the owner of a service) to upload verification documents. */
export async function remindToUploadDocuments(targetType: DocTarget, targetId: string) {
    const admin = await requireAdmin();
    if (await isOwnTarget(admin.id, targetType, targetId)) throw new Error("You cannot remind yourself.");
    const db = createAdminClient();

    let ownerId: string | null = null;
    let name = "";
    let subject = "your profile";
    if (targetType === 'profile') {
        const { data } = await db.from('profiles').select('id, first_name').eq('id', targetId).maybeSingle();
        ownerId = data?.id ?? null;
        name = data?.first_name || "there";
    } else {
        const { data } = await db.from('support_services').select('user_id, name').eq('id', targetId).maybeSingle();
        ownerId = data?.user_id ?? null;
        name = data?.name || "there";
        subject = `your service "${data?.name || "service"}"`;
    }
    if (!ownerId) throw new Error("Could not find who to remind.");
    if ((await countDocuments(targetType, targetId)) > 0) throw new Error("Documents have already been uploaded.");

    const link = targetType === 'profile' ? '/dashboard/profile?section=account' : '/dashboard/profile?section=services';
    const message = `Please upload your verification documents so we can review ${subject}. We can only verify against documents.`;
    await sendNotification({
        userId: ownerId,
        type: 'system_alert',
        title: "Please upload your verification documents",
        message,
        link,
        metadata: { reminder: 'upload_documents', target_type: targetType, target_id: targetId, action_by: admin.id },
        sendEmail: true,
    });
    return { success: true };
}

/** Open (or create) the admin's direct chat with a professional/NGO. It appears in both people's chat lists. */
export async function openAdminChat(profileId: string): Promise<string> {
    const admin = await requireAdmin();
    if (profileId === admin.id) throw new Error("You cannot message yourself.");
    const db = createAdminClient();

    const { data: shared } = await db.from('chat_participants').select('chat_id, user_id').in('user_id', [admin.id, profileId]);
    const mine = new Set((shared || []).filter(p => p.user_id === admin.id).map(p => p.chat_id));
    const both = (shared || []).filter(p => p.user_id === profileId && mine.has(p.chat_id)).map(p => p.chat_id);
    if (both.length) {
        const { data: dm } = await db.from('chats').select('id')
            .in('id', both).eq('type', 'dm')
            .order('last_message_at', { ascending: false, nullsFirst: false }).limit(1);
        if (dm?.[0]) return dm[0].id;
    }

    const { data: chat, error } = await db.from('chats')
        .insert({ type: 'dm', created_by: admin.id, metadata: { admin_review: true } })
        .select('id').single();
    if (error || !chat) throw new Error("Could not start the chat.");
    const { error: partError } = await db.from('chat_participants').insert([
        { chat_id: chat.id, user_id: admin.id, status: { role: 'admin' } },
        { chat_id: chat.id, user_id: profileId, status: { role: 'member' } },
    ]);
    if (partError) {
        await db.from('chats').delete().eq('id', chat.id);
        throw new Error("Could not start the chat.");
    }
    return chat.id;
}

export async function performAdminAction({ targetId, targetType, action, notes }: AdminActionParams) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Verifying/rejecting/banning is an admin power (RLS also enforces it, but fail early and clearly).
    const { data: actor } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!actor?.is_admin) {
        throw new Error("Forbidden");
    }

    // Nobody reviews their own profile or services (no self-approval, and no notifying yourself).
    if (await isOwnTarget(user.id, targetType, targetId)) {
        throw new Error("You cannot review your own profile or services. Another admin must do it.");
    }

    // Verification is decided against documents, so there is nothing to approve or reject until some are uploaded.
    if ((action === 'verify' || action === 'reject') && (await countDocuments(targetType, targetId)) === 0) {
        throw new Error("No documents have been uploaded yet. Remind them to upload documents first.");
    }

    // Determine status
    const status = action === 'verify' ? 'verified' : (action === 'ban' ? 'suspended' : 'rejected');

    // Remember where it was, for the audit trail.
    const { data: before } = await supabase
        .from(targetType === 'profile' ? 'profiles' : 'support_services')
        .select('verification_status')
        .eq('id', targetId)
        .maybeSingle();
    const previousStatus = before?.verification_status ?? 'unknown';

    // 1. Update Target Status
    const updatePayload: any = {
        verification_status: status,
        verification_notes: notes,
        verification_updated_at: new Date().toISOString(),
        reviewed_by: {
            reviewer_id: user.id,
            reviewed_at: new Date().toISOString(),
            action: action,
            notes: notes
        }
    };

    if (action === 'verify' && targetType === 'profile') {
        updatePayload.isVerified = true;
        updatePayload.admin_verified_by = user.id;
        updatePayload.admin_verified_at = new Date().toISOString();
    }

    if (action === 'verify' && targetType === 'service') {
        updatePayload.verified_by = user.id;
        updatePayload.verified_at = new Date().toISOString();
        updatePayload.is_active = true; // a verified service is matchable
    }

    const table = targetType === 'profile' ? 'profiles' : 'support_services';
    const { error: updateError, data: updatedItem } = await supabase
        .from(table)
        .update(updatePayload)
        .eq('id', targetId)
        .select('*')
        .single();

    if (updateError) throw new Error(updateError.message);

    // 2. Fetch Owner/User for Notification
    let ownerId: string | null = null;
    let ownerName = "";
    
    if (targetType === 'profile') {
        const profile = updatedItem as Database["public"]["Tables"]["profiles"]["Row"];
        ownerId = targetId;
        ownerName = profile.first_name || "Professional";
    } else {
        const service = updatedItem as Database["public"]["Tables"]["support_services"]["Row"];
        ownerId = service.user_id;
        ownerName = service.name || "Service";
    }

    // 3. Log Action
    const dbActionType = `${action}_${targetType === 'profile' ? 'user' : 'service'}` as any;
    
    await supabase.from('admin_actions').insert({
        admin_id: user.id,
        action_type: dbActionType,
        target_id: targetId,
        target_type: targetType === 'profile' ? 'user' : 'service',
        details: { notes, previous_status: previousStatus } as any
    });

    // 4. Send Notification
    const notificationTitle = targetType === 'profile' 
        ? "Profile Verification Update"
        : "Service Verification Update";
    
    // Construct simplified message for In-App
    const notificationMessage = targetType === 'profile' 
        ? `Your profile verification status has been updated to ${status}.`
        : `Your service "${ownerName}" verification status has been updated to ${status}.`;

    const notificationLink = targetType === 'profile' 
        ? '/dashboard/profile?section=account'
        : '/dashboard/profile?section=services';

    // Generate HTML Template
    let htmlContent = "";
    if (targetType === 'profile') {
        if (action === 'verify') htmlContent = profileVerifiedEmail(ownerName);
        if (action === 'reject') htmlContent = profileRejectedEmail(ownerName, notes || 'No specific feedback provided.');
    } else {
        if (action === 'verify') htmlContent = serviceVerifiedEmail(ownerName);
        if (action === 'reject') htmlContent = serviceRejectedEmail(ownerName, notes || 'No specific feedback provided.');
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

    // A newly verified provider/service may be the answer to reports that are still waiting.
    if (action === 'verify') {
        after(async () => {
            try {
                await backfillUnmatched(createAdminClient());
            } catch (err) {
                console.error('Post-verification matching failed:', err);
            }
        });
    }

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/admin/review');
    return { success: true };
}
