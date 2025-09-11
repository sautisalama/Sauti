import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-3">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-[60%] mx-auto" />
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-[80%]" />
            <Skeleton className="h-4 w-[70%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
