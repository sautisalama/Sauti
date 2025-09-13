"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ChatLoadingSkeleton() {
	return (
		<div className="flex h-[calc(100vh-0px)] w-full">
			{/* Left rail skeleton */}
			<div className="hidden md:flex flex-col w-96 border-r border-gray-200 bg-white overflow-hidden">
				<div className="p-3 border-b">
					<div className="flex gap-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-20" />
					</div>
				</div>
				<div className="flex-1 overflow-y-auto p-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<div key={i} className="flex items-start gap-2 p-2 mb-2">
							<Skeleton className="w-9 h-9 rounded-full" />
							<div className="flex-1 min-w-0">
								<Skeleton className="h-4 w-24 mb-1" />
								<Skeleton className="h-3 w-32" />
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Main area skeleton */}
			<div className="flex-1 flex flex-col min-w-0">
				<div className="md:hidden p-2 bg-white border-b flex gap-2 sticky top-0 z-10">
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-20" />
				</div>
				<div className="flex-1 bg-gray-50 p-4">
					<div className="max-w-4xl mx-auto">
						{/* Chat messages skeleton */}
						<div className="space-y-4">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={i}
									className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
											i % 2 === 0 ? "bg-blue-500" : "bg-white"
										}`}
									>
										<Skeleton
											className={`h-4 w-full ${
												i % 2 === 0 ? "bg-blue-400" : "bg-gray-300"
											}`}
										/>
										{i % 3 === 0 && (
											<Skeleton
												className={`h-4 w-3/4 mt-1 ${
													i % 2 === 0 ? "bg-blue-400" : "bg-gray-300"
												}`}
											/>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
