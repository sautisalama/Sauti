"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Badge } from "./badge";

interface MultiSelectProps {
	selected: string[];
	onChange: (selected: string[]) => void;
	placeholder?: string;
	options: readonly {
		value: string;
		label: string;
	}[];
}

export function MultiSelect({
	selected,
	onChange,
	placeholder = "Select options...",
	options,
}: MultiSelectProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [open, setOpen] = React.useState(false);
	const [inputValue, setInputValue] = React.useState("");

	const handleUnselect = React.useCallback(
		(option: string) => {
			onChange(selected.filter((s) => s !== option));
		},
		[selected, onChange]
	);

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (e.key === "Backspace" && !inputValue && selected.length > 0) {
				onChange(selected.slice(0, -1));
			}
		},
		[inputValue, onChange, selected]
	);

	const handleSelect = React.useCallback(
		(optionValue: string) => {
			onChange(
				selected.includes(optionValue)
					? selected.filter((s) => s !== optionValue)
					: [...selected, optionValue]
			);
			setInputValue("");
			// Keep dropdown open for multiple selections on mobile
			if (window.innerWidth < 640) {
				setOpen(true);
				// Refocus input after selection
				setTimeout(() => {
					inputRef.current?.focus();
				}, 50);
			} else {
				setOpen(false);
			}
		},
		[selected, onChange]
	);

	return (
		<div className="relative">
			<div
				className="group border border-input px-3 py-2 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
				onMouseDown={(e) => {
					// Focus input to open the menu; avoid toggling state if already focused
					if (document.activeElement !== inputRef.current) {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
				onTouchEnd={(e) => {
					// Handle mobile touch events - always focus on mobile
					e.preventDefault();
					inputRef.current?.focus();
				}}
				onClick={(e) => {
					// Ensure input gets focus on click
					if (document.activeElement !== inputRef.current) {
						e.preventDefault();
						inputRef.current?.focus();
					}
				}}
			>
				<div className="flex gap-1 flex-wrap">
					{selected.map((option) => {
						const label =
							options.find((opt) => opt.value === option)?.label || option;
						return (
							<Badge key={option} variant="secondary">
								{label}
								<button
									className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 touch-manipulation"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleUnselect(option);
										}
									}}
									onMouseDown={(e) => {
										e.preventDefault();
										e.stopPropagation();
									}}
									onTouchEnd={(e) => {
										e.preventDefault();
										e.stopPropagation();
										handleUnselect(option);
									}}
									onClick={(e) => {
										e.stopPropagation();
										handleUnselect(option);
									}}
								>
									<X className="h-3 w-3" />
								</button>
							</Badge>
						);
					})}
					<input
						ref={inputRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onBlur={() => {
							// Shorter delay for mobile, longer for desktop
							const delay = window.innerWidth < 640 ? 100 : 200;
							setTimeout(() => setOpen(false), delay);
						}}
						onFocus={() => setOpen(true)}
						placeholder={selected.length === 0 ? placeholder : undefined}
						className="ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-0"
					/>
				</div>
			</div>
			{open && (
				<div className="absolute w-full z-50 top-[calc(100%+4px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in max-h-[50vh] sm:max-h-60 left-0 right-0">
					<div className="overflow-auto max-h-[50vh] sm:max-h-60">
						{options.map((option) => (
							<button
								key={option.value}
								className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground touch-manipulation"
								onMouseDown={(e) => {
									e.preventDefault();
									handleSelect(option.value);
								}}
								onTouchEnd={(e) => {
									e.preventDefault();
									handleSelect(option.value);
								}}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
