import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
       {/* Breadcrumb */}
       <Skeleton className="h-4 w-48 mb-6 rounded-md" />

       {/* Blog Manager Card */}
       <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
           <CardHeader className="border-b border-gray-100 bg-white">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-7 w-48 rounded-lg" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <Skeleton className="h-4 w-64 mt-2 rounded-md" />
           </CardHeader>
           <CardContent className="p-6 space-y-6">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Skeleton className="h-10 flex-1 rounded-full" />
                    <Skeleton className="h-10 w-48 rounded-xl" />
                </div>

                {/* Table */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                     <div className="bg-gray-50/50 p-4 border-b border-gray-100 grid grid-cols-6 gap-4">
                         {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-4 w-full rounded-md" />)}
                     </div>
                     <div className="space-y-0">
                         {[1, 2, 3, 4, 5].map((i) => (
                             <div key={i} className="p-4 border-b border-gray-50 grid grid-cols-6 gap-4 items-center">
                                 <Skeleton className="h-4 w-24 rounded-md col-span-2" />
                                 <Skeleton className="h-6 w-16 rounded-full" />
                                 <Skeleton className="h-6 w-16 rounded-full" />
                                 <Skeleton className="h-4 w-20 rounded-md" />
                                 <div className="flex justify-end gap-2">
                                     <Skeleton className="h-8 w-8 rounded-md" />
                                     <Skeleton className="h-8 w-8 rounded-md" />
                                 </div>
                             </div>
                         ))}
                     </div>
                </div>
           </CardContent>
       </Card>
    </div>
  );
}
