import { LottieLoader } from "@/components/ui/LottieLoader";
import sandsOfTime from "@/public/lottie-animations/sands-of-time.json";

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden bg-serene-neutral-50/10">
      {/* Sidebar Shell - Keep for layout stability */}
      <div className="hidden md:block fixed left-0 h-full w-[72px] bg-white/50 backdrop-blur-md border-r border-serene-neutral-200" />
      
      <main className="flex-1 md:ml-[72px] flex flex-col items-center justify-center p-6 bg-transparent relative">
        <div className="absolute inset-0 bg-gradient-to-br from-serene-blue-50/20 via-white/50 to-serene-neutral-100/30 backdrop-blur-[2px]" />
        
        <div className="z-10 text-center space-y-4">
            <LottieLoader 
                animationData={sandsOfTime} 
                size={220} 
            />
            <div className="space-y-2 animate-pulse">
                <p className="text-serene-blue-900 font-bold tracking-tight text-lg">Preparing your dashboard...</p>
                <p className="text-serene-neutral-500 text-sm italic font-medium">Safe Voice Platform</p>
            </div>
        </div>
      </main>
    </div>
  );
}

