"use client";

import Lottie from "lottie-react";
import { motion } from "framer-motion";

interface LottieLoaderProps {
  animationData: any;
  size?: number;
  className?: string;
  loop?: boolean;
  /** Skip the pale badge the dark theme puts behind the artwork. */
  plain?: boolean;
}

export function LottieLoader({ 
  animationData, 
  size = 200, 
  className = "",
  loop = true,
  plain = false
}: LottieLoaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center ${className}`}
    >
      <div className={plain ? "" : "lottie-art"} style={{ width: size, height: size }}>
        <Lottie 
          animationData={animationData} 
          loop={loop}
          autoplay={true}
        />
      </div>
    </motion.div>
  );
}
