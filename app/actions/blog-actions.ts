'use server';

import { createClient } from "@/utils/supabase/server";
import { broadcastNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export type BlogParams = {
    id?: string;
    title: string;
    content: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    is_event: boolean;
    event_details: any;
    author_id: string;
};

export async function manageBlogPost(params: BlogParams) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Check if it's a new publication
    let shouldBroadcast = false;
    let publishedAt = null;

    if (params.status === 'published') {
        if(params.id) {
            // Check existing
            const { data: existing } = await supabase
                .from('blogs')
                .select('status, published_at')
                .eq('id', params.id)
                .single();
            
            if (existing && existing.status !== 'published') {
                shouldBroadcast = true;
                publishedAt = new Date().toISOString();
            } else if (existing && existing.status === 'published') {
                publishedAt = existing.published_at; // Keep original date
            }
        } else {
            // New post directly published
            shouldBroadcast = true;
            publishedAt = new Date().toISOString();
        }
    }

    const postData = {
        title: params.title,
        content: params.content,
        status: params.status,
        is_event: params.is_event,
        event_details: params.is_event ? params.event_details : null,
        author_id: params.id ? params.author_id : user.id,
        updated_at: new Date().toISOString(),
        ...(publishedAt && { published_at: publishedAt })
    };

    let result;
    if (params.id) {
        const { data, error } = await supabase
            .from("blogs")
            .update(postData)
            .eq("id", params.id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        result = data;
    } else {
        const { data, error } = await supabase
            .from("blogs")
            .insert([postData])
            .select()
            .single();
        if (error) throw new Error(error.message);
        result = data;
    }

    // Trigger Broadcast if needed
    if (shouldBroadcast) {
        // We don't await this to avoid blocking the UI response, 
        // OR we await if we want to ensure it's queued. 
        // Given it's a batch insert, it might take a moment.
        // For reliability, we await.
        try {
            await broadcastNotification({
                type: 'new_content',
                title: params.is_event ? 'New Event: ' + params.title : 'New Blog: ' + params.title,
                message: params.is_event 
                    ? `A new event "${params.title}" has been published. Check it out!` 
                    : `New article published: "${params.title}". Read it now.`,
                link: '/dashboard/resources', // Assuming this is where blogs live
                metadata: { blog_id: result.id, is_event: params.is_event }
            });
        } catch (err) {
            console.error("Failed to broadcast notification:", err);
            // Don't fail the request, just log
        }
    }

    revalidatePath('/dashboard/admin/blogs');
    revalidatePath('/dashboard/resources');
    return { success: true, data: result };
}

export async function deleteBlogPost(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("blogs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath('/dashboard/admin/blogs');
    return { success: true };
}
