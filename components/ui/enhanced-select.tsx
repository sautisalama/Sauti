"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

interface EnhancedSelectProps {
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	required?: boolean;
	className?: string;
	disabled?: boolean;
	name?: string;
}

export function EnhancedSelect({
	options,
	value,
	onChange,
	placeholder = "Select an option",
	required = false,
	className,
	disabled = false,
	name,
}: EnhancedSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const selectRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	const selectedOption = options.find((option) => option.value === value);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setFocusedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (isOpen && listRef.current && focusedIndex >= 0) {
			const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
			if (focusedElement) {
				focusedElement.scrollIntoView({ block: "nearest" });
			}
		}
	}, [focusedIndex, isOpen]);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (disabled) return;

		switch (event.key) {
			case "Enter":
			case " ":
				event.preventDefault();
				if (isOpen && focusedIndex >= 0) {
					const option = options[focusedIndex];
					if (!option.disabled) {
						onChange(option.value);
						setIsOpen(false);
						setFocusedIndex(-1);
					}
				} else {
					setIsOpen(!isOpen);
				}
				break;
			case "ArrowDown":
				event.preventDefault();
				if (!isOpen) {
					setIsOpen(true);
				} else {
					setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (!isOpen) {
					setIsOpen(true);
				} else {
					setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
				}
				break;
			case "Escape":
				setIsOpen(false);
				setFocusedIndex(-1);
				break;
		}
	};

	const handleOptionClick = (option: SelectOption) => {
		if (!option.disabled) {
			onChange(option.value);
			setIsOpen(false);
			setFocusedIndex(-1);
		}
	};

	return (
		<div ref={selectRef} className={cn("relative", className)}>
			<input type="hidden" name={name} value={value} required={required} />
			<button
				type="button"
				onClick={() => !disabled && setIsOpen(!isOpen)}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				className={cn(
					"w-full px-4 py-3 text-left bg-white border border-neutral-200 rounded-2xl",
					"focus:outline-none focus:ring-4 focus:ring-sauti-teal/10 focus:border-sauti-teal/50",
					"transition-all duration-300 ease-out",
					"hover:border-neutral-300 hover:bg-neutral-50/50",
					isOpen && "border-sauti-teal/50 ring-4 ring-sauti-teal/10 bg-white",
					disabled && "opacity-50 cursor-not-allowed bg-gray-50",
					"flex items-center justify-between min-h-[52px]"
				)}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-labelledby={`${name}-label`}
			>
				<span className={cn("truncate", !selectedOption && "text-gray-500")}>
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<ChevronDown
					className={cn(
						"h-5 w-5 text-gray-400 transition-transform duration-200",
						isOpen && "rotate-180"
					)}
				/>
			</button>

			{isOpen && (
				<div className="absolute z-[9999] w-full mt-2 bg-white border border-neutral-200 rounded-2xl shadow-xl shadow-sauti-dark/5 max-h-60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
					<ul
						ref={listRef}
						role="listbox"
						className="py-2"
						aria-labelledby={`${name}-label`}
					>
						{options.map((option, index) => (
							<li
								key={option.value}
								onClick={() => handleOptionClick(option)}
								onMouseEnter={() => setFocusedIndex(index)}
								className={cn(
									"px-4 py-3.5 cursor-pointer transition-colors duration-200",
									"flex items-center justify-between mx-1.5 rounded-xl my-0.5",
									"hover:bg-sauti-teal/5 hover:text-sauti-teal",
									focusedIndex === index && "bg-sauti-teal/5 text-sauti-teal",
									option.disabled && "opacity-50 cursor-not-allowed",
									value === option.value && "bg-sauti-teal/10 text-sauti-teal font-bold"
								)}
								role="option"
								aria-selected={value === option.value}
								tabIndex={-1}
							>
								<span className="truncate">{option.label}</span>
								{value === option.value && <Check className="h-4 w-4 text-sauti-teal" />}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
