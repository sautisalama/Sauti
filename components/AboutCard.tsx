import { BellRing, Check } from "lucide-react";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "./ui/card";
import React from "react";

interface AnimatedButtonProps {
	text: string;
	icon: React.ReactNode;
	title: string;
	className?: string;
	onClick?: () => void;
}

export default function AboutCard({
	text,
	icon,
	title,
	className,
	onClick,
}: AnimatedButtonProps) {
	return (
		<Card
			className={`w-full sm:w-[48%] lg:w-[30%] shadow-[0_0_20px_rgba(199,199,199,0.7)] p-4 ${className}`}
		>
			<CardHeader>
				<CardTitle>
					<div className="bg-landing p-2 max-w-fit rounded-md flex items-center justify-center flex-col text-sauti-orange">
						{icon}
					</div>
				</CardTitle>
				<CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-center space-x-4">
					<p className="text-sm sm:text-base text-muted-foreground">{text}</p>
				</div>
			</CardContent>
		</Card>
	);
}
