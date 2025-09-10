export default function Loading() {
  return (
    <div className="flex h-screen">
      <main className="flex-1 p-3 space-y-2">
        <div className="h-10 bg-white/80 backdrop-blur border-b flex items-center px-3">
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="space-y-2 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
          ))}
        </div>
      </main>
    </div>
  );
}
