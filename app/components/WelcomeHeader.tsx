"use client";

import { Tables } from "@/types/db-schema";
import React from "react";

type WelcomeHeaderProps = {
	profileDetails: Tables<"profiles">;
};

export default function WelcomeHeader({ profileDetails }: WelcomeHeaderProps) {
	const displayName = profileDetails.first_name || "Guest";

	return (
		<div className="mb-8">
			<h1 className="text-2xl font-bold">
				Hello <span className="text-teal-600">{displayName}</span>
			</h1>
			<p className="text-gray-500">
				Welcome to your dashboard. Here's your overview.
			</p>
		</div>
	);
}
