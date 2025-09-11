import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen">
      <main className="flex-1 p-3 space-y-2">
        <div className="bg-white/80 backdrop-blur border-b flex items-center px-3 h-10">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2 p-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}
