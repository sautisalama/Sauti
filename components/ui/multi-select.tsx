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

	const handleUnselect = (option: string) => {
		onChange(selected.filter((s) => s !== option));
	};

	const handleKeyDown = React.useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (e.key === "Backspace" && !inputValue && selected.length > 0) {
				onChange(selected.slice(0, -1));
			}
		},
		[inputValue, onChange, selected]
	);

	const handleSelect = (optionValue: string) => {
		onChange(
			selected.includes(optionValue)
				? selected.filter((s) => s !== optionValue)
				: [...selected, optionValue]
		);
		setInputValue("");
		setOpen(false);
	};

	return (
		<div className="relative">
			<div
				className="group border border-input px-3 py-2 text-sm ring-offset-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
				onClick={() => setOpen(true)}
			>
				<div className="flex gap-1 flex-wrap">
					{selected.map((option) => {
						const label =
							options.find((opt) => opt.value === option)?.label || option;
						return (
							<Badge key={option} variant="secondary">
								{label}
								<button
									className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											handleUnselect(option);
										}
									}}
									onMouseDown={(e) => {
										e.preventDefault();
										e.stopPropagation();
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
						onBlur={() => setTimeout(() => setOpen(false), 200)}
						onFocus={() => setOpen(true)}
						placeholder={selected.length === 0 ? placeholder : undefined}
						className="ml-2 bg-transparent outline-none placeholder:text-muted-foreground flex-1"
					/>
				</div>
			</div>
			{open && (
				<div className="absolute w-full z-10 top-[calc(100%+4px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
					<div className="overflow-auto max-h-60">
						{options.map((option) => (
							<button
								key={option.value}
								className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
								onMouseDown={(e) => {
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
