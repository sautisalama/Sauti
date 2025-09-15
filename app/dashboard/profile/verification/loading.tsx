import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function VerificationLoading() {
	return (
		<div className="space-y-6">
			{/* Progress Bar Skeleton */}
			<Card>
				<CardContent className="p-3">
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-48" />
							</div>
							<Skeleton className="h-6 w-20" />
						</div>
						<Skeleton className="h-2 w-full" />
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
							{Array.from({ length: 4 }).map((_, i) => (
								<div key={i} className="p-2 rounded-md border">
									<div className="flex items-center gap-2">
										<Skeleton className="h-4 w-4 rounded-full" />
										<div className="space-y-1 flex-1">
											<Skeleton className="h-3 w-16" />
											<Skeleton className="h-2 w-20" />
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Main Content Grid */}
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-6">
				{/* Document Upload Form Skeleton - Desktop Only */}
				<div className="hidden sm:block lg:col-span-1 xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-3 sm:pb-4">
							<div className="space-y-2">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-4 w-64" />
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{Array.from({ length: 2 }).map((_, i) => (
									<div key={i} className="space-y-3">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-10 w-full" />
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-20 w-full" />
									</div>
								))}
								<div className="flex gap-2">
									<Skeleton className="h-8 w-20" />
									<Skeleton className="h-8 w-24" />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Mobile Documents Header Skeleton */}
				<div className="sm:hidden">
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<div className="space-y-1">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-20" />
								</div>
								<Skeleton className="h-8 w-16" />
							</div>
						</CardHeader>
					</Card>
				</div>

				{/* Uploaded Documents List Skeleton */}
				<div className="lg:col-span-1 xl:col-span-3">
					<Card className="h-fit">
						<CardHeader className="pb-3 sm:pb-4">
							<Skeleton className="h-5 w-40" />
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<div key={i} className="bg-white rounded-lg border p-4">
										<div className="flex items-start justify-between mb-3">
											<div className="flex items-center gap-3 flex-1 min-w-0">
												<Skeleton className="h-10 w-10 rounded-full" />
												<div className="min-w-0 flex-1 space-y-1">
													<Skeleton className="h-4 w-32" />
													<Skeleton className="h-3 w-20" />
												</div>
											</div>
											<Skeleton className="h-6 w-16" />
										</div>
										<div className="flex gap-2">
											<Skeleton className="h-8 w-20" />
											<Skeleton className="h-8 w-16" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Support Services Skeleton */}
			<Card>
				<CardHeader className="pb-3 sm:pb-4">
					<Skeleton className="h-5 w-40" />
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 2 }).map((_, i) => (
							<div key={i} className="border rounded-lg p-4">
								<div className="flex items-center justify-between mb-3">
									<div className="space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
									<Skeleton className="h-6 w-16" />
								</div>
								<div className="space-y-2">
									<Skeleton className="h-3 w-20" />
									{Array.from({ length: 2 }).map((_, j) => (
										<div
											key={j}
											className="flex items-center justify-between p-2 bg-gray-50 rounded"
										>
											<div className="flex items-center gap-2">
												<Skeleton className="h-4 w-4" />
												<Skeleton className="h-3 w-24" />
											</div>
											<Skeleton className="h-5 w-12" />
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Verification Actions Skeleton */}
			<Card>
				<CardContent className="p-4">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-10 w-32" />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
