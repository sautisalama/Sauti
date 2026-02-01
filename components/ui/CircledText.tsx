
import React from 'react';

interface CircledTextProps {
  children: React.ReactNode;
  className?: string; // For text styling
  circleColor?: string; // Hex or tailwind class text color logic overrides this usually, but good to have
}

export function CircledText({ children, className = "", circleColor = "#00cf8d" }: CircledTextProps) {
  return (
    <span className={`relative inline-block px-4 z-10 ${className}`}>
      <span className="relative z-10">{children}</span>
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] -z-10 pointer-events-none"
        viewBox="0 0 200 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M10.5 40.5C10.5 40.5 25.5 10.5 100.5 10.5C175.5 10.5 190.5 35.5 190.5 45.5C190.5 55.5 165.5 75.5 95.5 70.5C25.5 65.5 5.5 50.5 10.5 40.5Z"
          stroke={circleColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="path-draw" 
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
