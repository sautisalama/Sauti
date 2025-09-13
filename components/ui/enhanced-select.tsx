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
					"w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-xl",
					"focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
					"transition-all duration-200 ease-in-out",
					"hover:border-gray-300",
					isOpen && "border-blue-500 ring-2 ring-blue-100",
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
				<div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-hidden">
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
									"px-4 py-3 cursor-pointer transition-colors duration-150",
									"flex items-center justify-between",
									"hover:bg-blue-50",
									focusedIndex === index && "bg-blue-50",
									option.disabled && "opacity-50 cursor-not-allowed",
									value === option.value && "bg-blue-100 text-blue-900"
								)}
								role="option"
								aria-selected={value === option.value}
								tabIndex={-1}
							>
								<span className="truncate">{option.label}</span>
								{value === option.value && <Check className="h-4 w-4 text-blue-600" />}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
