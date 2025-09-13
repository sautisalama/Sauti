"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedToggleProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	id: string;
	label: string;
	description?: string;
	className?: string;
}

export function EnhancedToggle({
	checked,
	onCheckedChange,
	id,
	label,
	description,
	className,
}: EnhancedToggleProps) {
	const [isHovering, setIsHovering] = useState(false);

	return (
		<div
			className={cn(
				"group relative p-4 rounded-xl border-2 transition-all duration-200",
				"hover:shadow-md hover:border-blue-200",
				checked
					? "bg-blue-50 border-blue-300 shadow-sm"
					: "bg-gray-50 border-gray-200",
				className
			)}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
		>
			<div className="flex items-start gap-4">
				{/* Icon */}
				<div
					className={cn(
						"flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
						checked ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500",
						isHovering && "scale-105"
					)}
				>
					{checked ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between">
						<Label
							htmlFor={id}
							className={cn(
								"text-sm font-medium cursor-pointer transition-colors duration-200 flex-1",
								checked ? "text-blue-900" : "text-gray-700"
							)}
						>
							{label}
						</Label>
						<Switch
							id={id}
							checked={checked}
							onCheckedChange={onCheckedChange}
							className="data-[state=checked]:bg-blue-500"
						/>
					</div>
					{description && (
						<p
							className={cn(
								"text-xs mt-1 transition-colors duration-200",
								checked ? "text-blue-700" : "text-gray-500"
							)}
						>
							{description}
						</p>
					)}
				</div>
			</div>

			{/* Animated background */}
			<div
				className={cn(
					"absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none",
					checked
						? "bg-gradient-to-r from-blue-50/50 to-blue-100/50"
						: "bg-transparent"
				)}
			/>
		</div>
	);
}
