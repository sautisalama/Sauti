import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 pb-20">
      {/* Welcome Header Skeleton */}
      <div className="p-6 md:p-8 rounded-3xl mb-8 border border-gray-100 bg-white">
        <Skeleton className="h-10 w-2/3 md:w-1/3 mb-4 rounded-xl" />
        <Skeleton className="h-6 w-1/2 md:w-1/4 rounded-lg" />
      </div>

      {/* Activity Feed Skeleton */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
           <div>
             <Skeleton className="h-7 w-48 mb-2 rounded-lg" />
             <Skeleton className="h-4 w-64 rounded-md" />
           </div>
           <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-50">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4 rounded-md" />
                        <Skeleton className="h-4 w-1/2 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Quick Action Grid Skeleton */}
      <div>
        <div className="mb-6">
            <Skeleton className="h-7 w-48 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                 <div key={i} className="rounded-2xl p-5 border border-gray-100 bg-white h-[140px] flex flex-col justify-between">
                    <div className="flex justify-between">
                         <Skeleton className="h-10 w-10 rounded-xl" />
                         <Skeleton className="h-5 w-8 rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <Skeleton className="h-4 w-32 rounded-md" />
                    </div>
                 </div>
            ))}
        </div>
      </div>
    </div>
  );
}
