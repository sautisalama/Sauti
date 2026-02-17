"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Users,
	UserCheck,
	Building2,
	Shield,
	CheckCircle,
	XCircle,
	AlertTriangle,
	UserX,
	MapPin,
} from "lucide-react";
import { AdminStats } from "@/types/admin-types";

interface AdminStatsCardsProps {
	stats: AdminStats;
}

export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
	const cards = [
		{
			title: "Total Users",
			value: stats.total_survivors + stats.total_professionals + stats.total_ngos,
			icon: Users,
			color: "text-sauti-blue",
			bgColor: "bg-sauti-blue/10",
			borderColor: "border-sauti-blue/20",
			details: [
				{
					label: "Survivors",
					value: stats.total_survivors,
					color: "text-serene-neutral-600",
				},
				{
					label: "Professionals",
					value: stats.total_professionals,
					color: "text-sauti-blue",
				},
				{ label: "NGOs", value: stats.total_ngos, color: "text-sauti-teal" },
			],
		},
		{
			title: "Verification Queue",
			value: stats.pending_verifications + stats.pending_service_verifications,
			icon: AlertTriangle,
			color: "text-sauti-orange",
			bgColor: "bg-sauti-orange/10",
			borderColor: "border-sauti-orange/20",
			details: [
				{
					label: "User Verifications",
					value: stats.pending_verifications,
					color: "text-sauti-orange",
				},
				{
					label: "Service Verifications",
					value: stats.pending_service_verifications,
					color: "text-sauti-orange",
				},
			],
		},
		{
			title: "Verified Content",
			value: stats.verified_users + stats.active_services,
			icon: CheckCircle,
			color: "text-sauti-teal",
			bgColor: "bg-sauti-teal/10",
			borderColor: "border-sauti-teal/20",
			details: [
				{
					label: "Verified Users",
					value: stats.verified_users,
					color: "text-sauti-teal",
				},
				{
					label: "Active Services",
					value: stats.active_services,
					color: "text-sauti-teal",
				},
			],
		},
		{
			title: "Banned Content",
			value: stats.banned_users + stats.banned_services,
			icon: UserX,
			color: "text-sauti-red",
			bgColor: "bg-sauti-red/10",
			borderColor: "border-sauti-red/20",
			details: [
				{ label: "Banned Users", value: stats.banned_users, color: "text-sauti-red" },
				{
					label: "Banned Services",
					value: stats.banned_services,
					color: "text-sauti-red",
				},
			],
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{cards.map((card, index) => (
				<Card
					key={index}
					className="bg-white border-serene-neutral-200 shadow-sm hover:shadow-md transition-all duration-300"
				>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-bold uppercase tracking-wider text-sauti-dark/60">
							{card.title}
						</CardTitle>
						<div className={`p-2 rounded-xl ${card.bgColor}`}>
							<card.icon className={`h-4 w-4 ${card.color}`} />
						</div>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-sauti-dark mb-4">
							{card.value.toLocaleString()}
						</div>
						<div className="space-y-2">
							{card.details.map((detail, detailIndex) => (
								<div key={detailIndex} className="flex justify-between text-xs">
									<span className="text-serene-neutral-500 font-medium">
										{detail.label}
									</span>
									<span className={`font-bold ${detail.color}`}>
										{detail.value.toLocaleString()}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
