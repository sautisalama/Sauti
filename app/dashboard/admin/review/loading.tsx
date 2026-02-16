export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-20">
             <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
					<div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
				</div>
                <div className="flex gap-2">
                    <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
			</div>
             <div className="space-y-6">
                <div className="flex gap-6 border-b border-gray-200 pb-0">
                     <div className="h-10 w-32 bg-gray-100 rounded-t animate-pulse" />
                     <div className="h-10 w-32 bg-gray-100 rounded-t animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
             </div>
        </div>
    )
}
