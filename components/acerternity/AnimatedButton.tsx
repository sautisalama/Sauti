import React from "react";
import { Button } from "../ui/button";

interface AnimatedButtonProps {
	text: string;
	icon: React.ReactNode;
	variant?: string;
	className?: string;
	onClick?: () => void;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
	text,
	icon,
	className = "",
	variant,
	onClick,
}) => {
	return (
		<Button
			variant={
				variant as
					| "default"
					| "destructive"
					| "outline"
					| "secondary"
					| "ghost"
					| "link"
					| null
					| undefined
			}
			onClick={onClick}
			className={`flex justify-center group/modal-btn relative overflow-hidden ${className}`}
		>
			<span className="group-hover/modal-btn:translate-x-40 text-center transition duration-500">
				{text}
			</span>
			<div className="-translate-x-40 group-hover/modal-btn:translate-x-0 flex items-center justify-center absolute inset-0 transition duration-500 text-white z-20 text-2xl">
				{icon}
			</div>
		</Button>
	);
};
