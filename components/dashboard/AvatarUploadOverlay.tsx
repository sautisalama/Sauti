"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { useToast } from "@/hooks/use-toast";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Sits on top of the profile photo: tap to choose a new one. Works whether the current photo came
 * from Google or an earlier upload; the new one simply replaces it everywhere.
 */
export function AvatarUploadOverlay() {
	const dash = useDashboardData();
	const profile = dash?.data?.profile;
	const userId = dash?.data?.userId;
	const { toast } = useToast();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);

	const upload = async (file: File) => {
		if (!userId || !profile) return;
		if (!file.type.startsWith("image/")) {
			toast({ title: "Choose an image", variant: "destructive" });
			return;
		}
		if (file.size > MAX_BYTES) {
			toast({ title: "Choose a smaller photo", description: "Up to 5 MB.", variant: "destructive" });
			return;
		}
		setBusy(true);
		try {
			const supabase = createClient();
			const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
			const path = `${userId}/avatar-${Date.now()}.${ext}`;
			const { error: upErr } = await supabase.storage.from("profile-images").upload(path, file, { contentType: file.type, upsert: true });
			if (upErr) throw upErr;
			const { data } = supabase.storage.from("profile-images").getPublicUrl(path);

			const { error } = await supabase.from("profiles").update({ avatar_url: data.publicUrl, profile_image_url: data.publicUrl }).eq("id", userId);
			if (error) throw error;
			dash?.updatePartial({ profile: { ...profile, avatar_url: data.publicUrl, profile_image_url: data.publicUrl } });
			toast({ title: "Profile photo updated" });
		} catch (e) {
			toast({ title: "Could not update your photo", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
		} finally {
			setBusy(false);
			if (input.current) input.current.value = "";
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={() => input.current?.click()}
				disabled={busy}
				aria-label="Change profile photo"
				className="absolute inset-0 flex items-center justify-center rounded-full bg-black/25 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/avatar:opacity-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:bg-black/10"
			>
				{busy ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Camera className="h-6 w-6 text-white drop-shadow-md sm:h-7 sm:w-7" />}
			</button>
			<input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
		</>
	);
}
