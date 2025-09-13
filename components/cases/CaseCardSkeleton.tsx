"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CaseCardSkeleton() {
	return (
		<div className="w-full rounded-lg border border-gray-200 bg-white p-3">
			<div className="flex items-start gap-2">
				{/* Avatar skeleton */}
				<div className="relative">
					<Skeleton className="h-8 w-8 rounded-lg" />
					<Skeleton className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full" />
				</div>

				{/* Content skeleton */}
				<div className="min-w-0 flex-1 space-y-2">
					{/* Header row */}
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-20" />
						</div>
						<Skeleton className="h-3 w-3" />
					</div>

					{/* Description skeleton */}
					<div className="space-y-1">
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-3/4" />
					</div>

					{/* Bottom row skeleton */}
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-12 rounded-md" />
						<Skeleton className="h-5 w-16 rounded-md" />
						<Skeleton className="h-3 w-20" />
					</div>
				</div>
			</div>
		</div>
	);
}
