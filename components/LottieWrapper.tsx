"use client";
import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

type Props = {
	speed?: number;
	animationData: any;
	loop?: boolean;
};

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), {
	ssr: false,
	loading: () => (
		<div className="max-w-sm h-32 bg-gray-100 animate-pulse rounded" />
	),
});

export default function Animation({ animationData, speed, loop }: Props) {
	const lottieRef = useRef<any>(null);
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
		if (lottieRef.current) {
			lottieRef.current.setSpeed(speed ?? 1);
		}
	}, [speed]);

	// Don't render on server side
	if (!isClient) {
		return <div className="max-w-sm h-32 bg-gray-100 animate-pulse rounded" />;
	}

	return (
		<div className="max-w-sm">
			<Lottie
				loop={loop ?? true}
				lottieRef={lottieRef}
				animationData={animationData}
			/>
		</div>
	);
}
