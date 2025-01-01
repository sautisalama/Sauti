"use client";

export function DailyProgress() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#E0F7F7] to-[#F0F9FF] p-6">
      <h3 className="text-xl font-semibold text-[#1A3434]">Daily Progress</h3>
      <p className="text-sm text-gray-600 mt-1">
        Keep improving the quality of your health
      </p>

      <div className="relative mt-8 flex items-center justify-center">
        <div className="relative h-40 w-40">
          {/* Progress circle background */}
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle
              className="stroke-current text-[#E0F7F7]"
              strokeWidth="10"
              fill="transparent"
              r="40"
              cx="50"
              cy="50"
            />
            {/* Progress circle foreground */}
            <circle
              className="stroke-current text-[#00A5A5]"
              strokeWidth="10"
              strokeLinecap="round"
              fill="transparent"
              r="40"
              cx="50"
              cy="50"
              strokeDasharray="251.2"
              strokeDashoffset="35.168" // 251.2 * (1 - 0.86) for 86%
              transform="rotate(-90 50 50)"
            />
          </svg>
          
          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-[#1A3434]">86%</span>
          </div>
        </div>
      </div>
    </div>
  );
} 