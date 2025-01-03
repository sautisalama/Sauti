'use client';
import React, { useEffect, useRef } from 'react';
import Lottie, { LottieOptions, LottieRefCurrentProps } from 'lottie-react';

type Props = {
	speed?: number;
	animationData: LottieOptions['animationData'];
	loop?: boolean;
};
export default function Animation({ animationData, speed, loop }: Props) {
	const lottieRef = useRef<LottieRefCurrentProps | null>(null);
	useEffect(() => {
		if (lottieRef.current) {
			lottieRef.current.setSpeed(speed ?? 1);
		}
	}, [speed]);
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
