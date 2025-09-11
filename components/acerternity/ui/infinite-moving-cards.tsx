"use client";

import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useState } from "react";

interface AnimatedButtonProps {
	items: {
		quote: string;
		name: string;
		title: string;
	}[];
	direction?: "left" | "right";
	speed?: "fast" | "normal" | "slow";
	pauseOnHover?: boolean;
	className?: string;
}

export const InfiniteMovingCards = ({
	items,
	direction = "left",
	speed = "slow",
	pauseOnHover = true,
	className,
}: AnimatedButtonProps) => {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const scrollerRef = React.useRef<HTMLUListElement>(null);

	const [start, setStart] = useState(false);
	const getDirection = useCallback(() => {
		if (containerRef.current) {
			if (direction === "left") {
				containerRef.current.style.setProperty("--animation-direction", "forwards");
			} else {
				containerRef.current.style.setProperty("--animation-direction", "reverse");
			}
		}
	}, [direction]);
	const getSpeed = useCallback(() => {
		if (containerRef.current) {
			if (speed === "fast") {
				containerRef.current.style.setProperty("--animation-duration", "80s");
			} else if (speed === "normal") {
				containerRef.current.style.setProperty("--animation-duration", "120s");
			} else {
				containerRef.current.style.setProperty("--animation-duration", "180s");
			}
		}
	}, [speed]);
	const addAnimation = useCallback(() => {
		if (containerRef.current && scrollerRef.current) {
			const scrollerContent = Array.from(scrollerRef.current.children);

			scrollerContent.forEach((item) => {
				const duplicatedItem = item.cloneNode(true);
				if (scrollerRef.current) {
					scrollerRef.current.appendChild(duplicatedItem);
				}
			});

			getDirection();
			getSpeed();
			setStart(true);
		}
	}, [getDirection, getSpeed]);
	useEffect(() => {
		addAnimation();
	}, [addAnimation]);

	return (
		<div
			ref={containerRef}
			className={cn(
				"scroller relative z-20  max-w-[100%] overflow-hidden  [mask-image:linear-gradient(to_right,transparent,gray_10%,gray_90%,transparent)]",
				className
			)}
		>
			<ul
				ref={scrollerRef}
				className={cn(
					" flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap",
					start && "animate-scroll ",
					pauseOnHover && "hover:[animation-play-state:paused]"
				)}
			>
				{items.map((item, idx) => (
					<li
						className="w-[350px] max-w-full relative rounded-2xl border border-b-0 flex-shrink-0 border-slate-700 px-8 py-6 md:w-[450px]"
						style={{
							background: "linear-gradient(180deg, white, #EEF7F2)",
						}}
						key={item.name}
					>
						<blockquote>
							<div
								aria-hidden="true"
								className="user-select-none -z-1 pointer-events-none absolute -left-0.5 -top-0.5 h-[calc(100%_+_4px)] w-[calc(100%_+_4px)]"
							></div>
							<span className=" relative z-20 text-sm leading-[1.6] text-sauti-black font-normal">
								{item.quote}
							</span>
							<div className="relative z-20 mt-6 flex flex-row items-center">
								<span className="flex flex-col gap-1">
									<span className=" text-sm leading-[1.6] text-sauti-blue  font-normal">
										{item.name}
									</span>
									<span className=" text-sm leading-[1.6] text-sauti-blue   font-normal">
										{item.title}
									</span>
								</span>
							</div>
						</blockquote>
					</li>
				))}
			</ul>
		</div>
	);
};
