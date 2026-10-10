import { Skeleton } from "@/components/ui/skeleton";

/** Shown at once while any Mjengo section loads: the same list skeleton the chats use. */
export default function Loading() {
	return (
		<div className="mx-auto w-full max-w-6xl space-y-3 p-3">
			<div className="flex items-center gap-3">
				<Skeleton className="h-9 w-9 rounded-xl" />
				<Skeleton className="h-6 w-40" />
				<div className="flex-1" />
				<Skeleton className="h-9 w-28 rounded-full" />
			</div>
			<div className="space-y-2">
				{Array.from({ length: 9 }).map((_, i) => (
					<Skeleton key={i} className="h-12 w-full" />
				))}
			</div>
		</div>
	);
}
