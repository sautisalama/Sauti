"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Database } from "@/types/db-schema";

type UserType = Database["public"]["Enums"]["user_type"];

export default function ChooseUser() {
	const [selectedType, setSelectedType] = useState<UserType | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const checkAnon = async () => {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			if (user?.user_metadata?.is_anonymous || user?.email?.endsWith("@anon.sautisalama.org")) {
				window.location.href = "/dashboard";
			}
		};
		checkAnon();
	}, []);

	const handleSubmit = async () => {
		if (!selectedType) return;

		setIsSubmitting(true);
		const supabase = createClient();

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("No user found");

			const { error } = await supabase
				.from("profiles")
				.update({ user_type: selectedType })
				.eq("id", user.id);

			if (error) throw error;

			// Refresh the page to reflect the new user type
			router.refresh();
		} catch (error) {
			console.error("Error updating user type:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl md:text-4xl font-black text-center mt-14 sm:mt-8 mb-4 text-sauti-dark tracking-tight">
					Choose Your Role
				</h1>
				<p className="text-neutral-500 text-center mb-12 max-w-md mx-auto">
					Select the role that best describes your needs. You can always change this in your profile settings later.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					{/* Survivor Tile */}
					<div
						className={`cursor-pointer rounded-[2rem] border-2 p-6 text-center transition-all duration-300 group relative overflow-hidden ${
							selectedType === "survivor"
								? "border-sauti-teal bg-sauti-teal/5 shadow-premium ring-4 ring-sauti-teal/10"
								: "border-neutral-100 hover:border-sauti-teal/30 hover:bg-neutral-50 shadow-sm"
						}`}
						onClick={() => setSelectedType("survivor")}
					>
						<div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-6 relative z-10">
							<div className="w-16 sm:w-24 aspect-square relative flex justify-center items-center bg-white rounded-2xl shadow-sm border border-neutral-100 group-hover:scale-110 transition-transform duration-500">
								<Image
									src="/icons/survivor-light.png"
									alt="Survivor"
									className="object-contain p-2"
									height={80}
									width={80}
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-black text-sauti-dark left sm:text-center group-hover:text-sauti-teal transition-colors">
									Survivor
								</h3>
								<p className="text-xs font-medium text-neutral-500 text-left sm:text-center mt-1">
									Seeking support and resources
								</p>
							</div>
						</div>
					</div>

					{/* Professional Tile */}
					<div
						className={`cursor-pointer rounded-[2rem] border-2 p-6 text-center transition-all duration-300 group relative overflow-hidden ${
							selectedType === "professional"
								? "border-sauti-teal bg-sauti-teal/5 shadow-premium ring-4 ring-sauti-teal/10"
								: "border-neutral-100 hover:border-sauti-teal/30 hover:bg-neutral-50 shadow-sm"
						}`}
						onClick={() => setSelectedType("professional")}
					>
						<div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-6 relative z-10">
							<div className="w-16 sm:w-24 aspect-square relative flex justify-center items-center bg-white rounded-2xl shadow-sm border border-neutral-100 group-hover:scale-110 transition-transform duration-500">
								<Image
									src="/icons/professional-light.png"
									alt="Service Provider"
									height={100}
									width={100}
									className="object-contain p-2"
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-black text-sauti-dark left sm:text-center group-hover:text-sauti-teal transition-colors">
									Service Provider
								</h3>
								<p className="text-xs font-medium text-neutral-500 text-left sm:text-center mt-1">
									Providing expert support
								</p>
							</div>
						</div>
					</div>

					{/* NGO Tile */}
					<div
						className={`cursor-pointer rounded-[2rem] border-2 p-6 text-center transition-all duration-300 group relative overflow-hidden ${
							selectedType === "ngo"
								? "border-sauti-teal bg-sauti-teal/5 shadow-premium ring-4 ring-sauti-teal/10"
								: "border-neutral-100 hover:border-sauti-teal/30 hover:bg-neutral-50 shadow-sm"
						}`}
						onClick={() => setSelectedType("ngo")}
					>
						<div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-6 relative z-10">
							<div className="w-16 sm:w-24 aspect-square relative flex justify-center items-center bg-white rounded-2xl shadow-sm border border-neutral-100 group-hover:scale-110 transition-transform duration-500">
								<Image
									src="/icons/ngo-light.png"
									alt="NGO"
									height={120}
									width={120}
									className="object-contain p-2"
								/>
							</div>
							<div className="flex-1 sm:w-full">
								<h3 className="text-lg font-black text-sauti-dark left sm:text-center group-hover:text-sauti-teal transition-colors">
									NGO
								</h3>
								<p className="text-xs font-medium text-neutral-500 text-left sm:text-center mt-1">
									Organization providing services
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Centered Continue Button */}
				<div className="flex justify-center">
					<Button
						onClick={handleSubmit}
						disabled={!selectedType || isSubmitting}
						className="bg-sauti-teal hover:bg-sauti-dark text-white font-black py-6 px-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 min-w-[240px]"
					>
						{isSubmitting ? "Updating Role..." : "Continue to Dashboard"}
					</Button>
				</div>
			</div>
		</div>
	);
}
