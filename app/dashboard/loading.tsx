import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen">
      <div className="hidden md:block fixed left-0 h-full w-[72px] bg-white border-r" />
      <main className="flex-1 md:ml-[72px] p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </main>
    </div>
  );
}

