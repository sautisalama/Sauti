import { Skeleton } from "@/components/ui/skeleton";

export function ReportCardSkeleton() {
	return (
		<div className="relative w-full rounded-lg border border-gray-200 bg-white p-3">
			{/* Left color accent */}
			<div className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-gray-200" />

			<div className="p-3">
				{/* Header */}
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="flex items-start gap-2 min-w-0 flex-1">
						{/* Avatar with status indicator */}
						<div className="relative">
							<Skeleton className="h-8 w-8 rounded-lg" />
							<Skeleton className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full" />
						</div>

						{/* Main content */}
						<div className="min-w-0 flex-1">
							<div className="flex items-start justify-between gap-2 mb-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-3" />
							</div>

							{/* Professional info */}
							<Skeleton className="h-3 w-24 mb-1" />

							{/* Description */}
							<Skeleton className="h-3 w-full mb-2" />

							{/* Tags and metadata */}
							<div className="flex flex-wrap items-center gap-1.5">
								<Skeleton className="h-5 w-12 rounded-md" />
								<Skeleton className="h-5 w-16 rounded-md" />
								<Skeleton className="h-5 w-20 rounded-md" />
							</div>
						</div>
					</div>
				</div>

				{/* Footer with timeline info */}
				<div className="flex items-center justify-between pt-2 border-t border-gray-100">
					<div className="flex items-center gap-3">
						<Skeleton className="h-3 w-20" />
					</div>
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
		</div>
	);
}
