"use client";

import React from "react";
import { InfiniteMovingCards } from "./ui/infinite-moving-cards";

export function InfiniteMovingCardsDemo() {
	const testimonials = [
		{
			quote:
				"As a GBV support coordinator, I'm excited about Sauti Salama's anonymous reporting feature. Currently, survivors have to physically visit centers which creates barriers. The app's discreet approach could help us reach the 44% of women facing violence who haven't been able to seek help.",
			name: "Ayana Bekele",
			title: "GBV Support Coordinator, Nairobi Women's Center",
		},
		{
			quote:
				"The current manual reporting systems make it difficult to track cases and provide timely support. Sauti Salama's digital platform promises real-time alerts and comprehensive case management. This could revolutionize how we respond to GBV cases.",
			name: "Malik Okonjo",
			title: "Police Gender Desk Officer",
		},
		{
			quote:
				"Our counseling center relies on walk-ins and referrals. Sauti Salama's mental health support feature would allow us to reach survivors remotely, especially corporate professionals who avoid seeking help due to stigma. The privacy-first approach is exactly what we need.",
			name: "Amara Nyongo",
			title: "Mental Health Counselor",
		},
		{
			quote:
				"As someone working with GBV survivors daily, I'm particularly impressed by how Sauti Salama integrates legal aid, medical care, and counseling in one platform. This could significantly reduce the traumatic experience of retelling their story multiple times.",
			name: "Jabari Mwangi",
			title: "Legal Aid Provider",
		},
		{
			quote:
				"The existing hotlines and walk-in centers have limited reach. Being on Sauti Salama's waitlist gives me hope that soon we'll have a tool that makes support services accessible 24/7, especially for survivors in remote areas who struggle to access physical centers.",
			name: "Zara Kenyatta",
			title: "Community Outreach Coordinator",
		},
	];

	return (
		<div className="rounded-md flex flex-col antialiased  items-center justify-center relative overflow-hidden">
			<InfiniteMovingCards items={testimonials} direction="left" speed="slow" />
		</div>
	);
}
