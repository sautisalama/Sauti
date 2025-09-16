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
			color: "text-blue-600",
			bgColor: "bg-blue-50",
			borderColor: "border-blue-200",
			details: [
				{
					label: "Survivors",
					value: stats.total_survivors,
					color: "text-gray-600",
				},
				{
					label: "Professionals",
					value: stats.total_professionals,
					color: "text-blue-600",
				},
				{ label: "NGOs", value: stats.total_ngos, color: "text-green-600" },
			],
		},
		{
			title: "Verification Queue",
			value: stats.pending_verifications + stats.pending_service_verifications,
			icon: AlertTriangle,
			color: "text-orange-600",
			bgColor: "bg-orange-50",
			borderColor: "border-orange-200",
			details: [
				{
					label: "User Verifications",
					value: stats.pending_verifications,
					color: "text-orange-600",
				},
				{
					label: "Service Verifications",
					value: stats.pending_service_verifications,
					color: "text-orange-600",
				},
			],
		},
		{
			title: "Verified Content",
			value: stats.verified_users + stats.active_services,
			icon: CheckCircle,
			color: "text-green-600",
			bgColor: "bg-green-50",
			borderColor: "border-green-200",
			details: [
				{
					label: "Verified Users",
					value: stats.verified_users,
					color: "text-green-600",
				},
				{
					label: "Active Services",
					value: stats.active_services,
					color: "text-green-600",
				},
			],
		},
		{
			title: "Banned Content",
			value: stats.banned_users + stats.banned_services,
			icon: UserX,
			color: "text-red-600",
			bgColor: "bg-red-50",
			borderColor: "border-red-200",
			details: [
				{ label: "Banned Users", value: stats.banned_users, color: "text-red-600" },
				{
					label: "Banned Services",
					value: stats.banned_services,
					color: "text-red-600",
				},
			],
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{cards.map((card, index) => (
				<Card key={index} className={`${card.borderColor} ${card.bgColor}`}>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium text-gray-600">
							{card.title}
						</CardTitle>
						<card.icon className={`h-4 w-4 ${card.color}`} />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold text-gray-900 mb-2">
							{card.value.toLocaleString()}
						</div>
						<div className="space-y-1">
							{card.details.map((detail, detailIndex) => (
								<div key={detailIndex} className="flex justify-between text-xs">
									<span className="text-gray-500">{detail.label}</span>
									<span className={`font-medium ${detail.color}`}>
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
