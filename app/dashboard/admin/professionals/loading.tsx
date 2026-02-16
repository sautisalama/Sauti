import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
       {/* Breadcrumb */}
       <Skeleton className="h-4 w-48 mb-6 rounded-md" />

       {/* Stats Grid */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           {[1, 2, 3].map(i => (
               <Skeleton key={i} className="h-28 rounded-2xl" />
           ))}
       </div>

       {/* Main Content */}
       <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-100">
               <div className="flex justify-between items-center">
                   <div>
                       <Skeleton className="h-7 w-48 mb-2 rounded-lg" />
                       <Skeleton className="h-4 w-64 rounded-md" />
                   </div>
               </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <Skeleton className="h-10 flex-1 rounded-full" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-24 rounded-xl" />
                </div>

                <div className="space-y-4">
                     {[1, 2, 3, 4, 5].map((i) => (
                         <div key={i} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                             <div className="flex gap-4 items-center">
                                 <Skeleton className="h-10 w-10 rounded-full" />
                                 <div className="space-y-2">
                                     <Skeleton className="h-4 w-40 rounded-md" />
                                     <Skeleton className="h-3 w-24 rounded-md" />
                                 </div>
                             </div>
                             <Skeleton className="h-6 w-24 rounded-full" />
                             <Skeleton className="h-6 w-24 rounded-full" />
                             <Skeleton className="h-4 w-24 rounded-md" />
                             <Skeleton className="h-8 w-20 rounded-md" />
                         </div>
                     ))}
                </div>
          </CardContent>
       </Card>
    </div>
  );
}
