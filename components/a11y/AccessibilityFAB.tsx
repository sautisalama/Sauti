"use client";

import { useState } from "react";
import { useAccessibility } from "@/components/a11y/AccessibilityProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, Type, Contrast, RefreshCw, X, MousePointer2, Type as FontIcon, Underline } from "lucide-react";

function ToggleRow({ label, property, icon: Icon }: { label: string; property: any; icon: any }) {
	const a11y = useAccessibility();
	const isOn = !!(a11y as any)[property];
	const toggle = () => {
		a11y.set({ [property]: !isOn });
	};
	return (
		<button
			onClick={toggle}
			className={cn(
				"w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all duration-200 group",
				isOn 
                    ? "bg-sauti-teal/10 border-sauti-teal text-sauti-teal shadow-sm" 
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-100/50"
			)}
			aria-pressed={isOn}
			aria-label={label}
		>
			<div className="flex items-center gap-3">
                <div className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isOn ? "bg-sauti-teal text-white" : "bg-white text-gray-400 group-hover:text-gray-500"
                )}>
                    <Icon className="h-4 w-4" />
                </div>
			    <span className="font-bold text-xs uppercase tracking-wider">{label}</span>
            </div>
			<div
				className={cn(
					"relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
					isOn ? "bg-sauti-teal" : "bg-gray-200"
				)}
			>
                <span
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        isOn ? "translate-x-5" : "translate-x-0"
                    )}
                />
            </div>
		</button>
	);
}

export default function AccessibilityFAB() {
	const a11y = useAccessibility();
	const [open, setOpen] = useState(false);

	const scale = String(a11y.textScale);
	const setScale = (val: string) => {
		const n = Number(val) || 100;
		a11y.set({ textScale: n });
	};

	return (
		<div className="fixed bottom-6 left-6 z-[100]">
			{open && (
				<div className="mb-4 w-80 rounded-[32px] border-2 border-gray-100 bg-white/95 backdrop-blur-xl shadow-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
					<div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sauti-dark font-black uppercase tracking-widest text-xs">
						    <Contrast className="h-4 w-4 text-sauti-teal" /> Accessibility Tools
					    </div>
                        <button 
                            onClick={() => setOpen(false)}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
					    <ToggleRow label="High contrast" property="highContrast" icon={Contrast} />
					    <ToggleRow label="Reduce motion" property="reduceMotion" icon={MousePointer2} />
					    <ToggleRow label="Readable font" property="readableFont" icon={FontIcon} />
					    <ToggleRow label="Dyslexic font" property="dyslexic" icon={Type} />
					    <ToggleRow label="Underline links" property="underlineLinks" icon={Underline} />
                    </div>

					<div className="pt-2">
						<div className="mb-2 flex items-center gap-2 text-gray-500 font-bold uppercase tracking-widest text-[10px]">
							<Type className="h-3 w-3" /> Text scale
						</div>
						<div className="flex flex-wrap gap-2">
                            {[100, 112.5, 125, 137.5, 150].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setScale(String(s))}
                                    className={cn(
                                        "flex-1 px-2 py-2 rounded-xl border-2 text-[10px] font-black transition-all",
                                        a11y.textScale === s
                                            ? "bg-sauti-yellow border-sauti-yellow text-sauti-dark"
                                            : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                                    )}
                                >
                                    {s}%
                                </button>
                            ))}
                        </div>
					</div>

                    <Button 
                        onClick={() => a11y.reset()}
                        variant="ghost"
                        className="w-full rounded-2xl h-10 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-sauti-red hover:bg-sauti-red/5 transition-all"
                    >
                        <RefreshCw className="h-3 w-3 mr-2" /> Reset all settings
                    </Button>
				</div>
			)}

			<button
				onClick={() => setOpen((v) => !v)}
				className={cn(
                    "group relative rounded-full h-14 w-14 flex items-center justify-center transition-all duration-300 shadow-xl hover:scale-110 active:scale-95",
                    open 
                        ? "bg-sauti-dark text-white rotate-90" 
                        : "bg-white text-sauti-teal border-2 border-sauti-teal/20"
                )}
				aria-label="Accessibility options"
				aria-expanded={open}
			>
				{open ? <X className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                
                {/* Tooltip */}
                {!open && (
                    <span className="absolute left-full ml-4 px-3 py-1.5 rounded-lg bg-sauti-dark text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                        Accessibility
                    </span>
                )}
			</button>
		</div>
	);
}
