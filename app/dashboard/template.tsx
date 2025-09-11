import { Suspense } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      {children}
    </Suspense>
  );
}

