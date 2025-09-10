export default function Loading() {
  return (
    <div className="flex h-screen">
      <div className="hidden md:block fixed left-0 h-full w-[72px] bg-white border-r" />
      <main className="flex-1 md:ml-[72px] p-6 space-y-4">
        <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-gray-100 animate-pulse rounded" />
          <div className="h-48 bg-gray-100 animate-pulse rounded" />
        </div>
        <div className="h-64 bg-gray-100 animate-pulse rounded" />
      </main>
    </div>
  );
}

