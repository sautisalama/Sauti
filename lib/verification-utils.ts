import { SupabaseClient } from "@supabase/supabase-js";

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'under_review' | 'suspended';

export interface VerificationDocument {
    title?: string;
    url: string;
    status?: 'verified' | 'rejected' | 'pending';
    notes?: string;
    // For service docs, we might have type/name
    name?: string;
    type?: string; 
    
    // Additional metadata used in UI
    uploadedAt?: string;
    fileSize?: number;
    fileType?: string;
    uploaded?: boolean;
    docNumber?: string;
    issuer?: string;
    docType?: string;
    id?: string;
    source?: string;
    sourceId?: string;
    sourceName?: string;
    linked?: boolean;
}

/**
 * pure function to calculate the new status based on documents and current status.
 */
export function calculateNewStatus(
    currentStatus: VerificationStatus | null,
    documents: VerificationDocument[],
    requiredTitles: string[] = [] // E.g. ['National ID (Front)', 'National ID (Back)']
): VerificationStatus {
    
    // 1. Check for Rejections
    const hasRejection = documents.some(doc => doc.status === 'rejected');
    if (hasRejection) {
        return 'rejected';
    }

    // 2. Check for Missing Requirements
    //For profiles, we need specific titles. For services, we usually just need *some* accreditation.
    if (requiredTitles.length > 0) {
        const missingReq = requiredTitles.some(reqTitle => 
            !documents.find(d => 
                (d.title === reqTitle) || 
                (d.title?.includes(reqTitle)) ||
                (reqTitle === 'National ID (Front)' && d.title?.includes("Front")) ||
                (reqTitle === 'National ID (Back)' && d.title?.includes("Back"))
            )
        );
        if (missingReq) return 'pending';
    } else {
        // If no specific titles required, implies "at least one document" (common for services)
        if (documents.length === 0) return 'pending';
    }

    // 3. Check for Pending/Empty (Redundant if we checked required, but good for safety)
    // If we are here, we have no rejections and have all required docs.
    
    // 4. Determine "In Review" vs "Verified"
    // If currently 'verified' and NO failures/rejections found, we stay 'verified' 
    // UNLESS the user just uploaded something new (which might reset to in_review).
    // However, this function is usually called AFTER a change. 
    // If a document is 'pending' status (default on upload), we should be 'under_review'.
    const hasPendingDocs = documents.some(doc => !doc.status || doc.status === 'pending');
    
    if (currentStatus === 'verified' && !hasPendingDocs) {
        return 'verified';
    }

    return 'under_review';
}


export async function updateProfileStatus(
    supabase: SupabaseClient, 
    profileId: string, 
    documents: VerificationDocument[],
    currentStatus: VerificationStatus
) {
    const newStatus = calculateNewStatus(currentStatus, documents, ['National ID (Front)', 'National ID (Back)']);
    
    if (newStatus !== currentStatus) {
        const { error } = await supabase.from('profiles').update({
            verification_status: newStatus,
            verification_updated_at: new Date().toISOString()
        }).eq('id', profileId);
        
        if (error) console.error("Failed to update profile status", error);
        return newStatus;
    }
    return currentStatus;
}

export async function updateServiceStatus(
    supabase: SupabaseClient, 
    serviceId: string, 
    documents: VerificationDocument[],
    currentStatus: VerificationStatus
) {
    // For services, we generally require at least one accreditation doc
    const newStatus = calculateNewStatus(currentStatus, documents, []); // Empty requiredTitles = just check length > 0
    
    if (newStatus !== currentStatus) {
         const { error } = await supabase.from('support_services').update({
            verification_status: newStatus,
            // Services table might track updated_at differently, but standardizing is good
        }).eq('id', serviceId);
        
        if (error) console.error("Failed to update service status", error);
        return newStatus;
    }
    return currentStatus;
}
