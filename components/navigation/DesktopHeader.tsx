"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationDropdown } from "./NotificationDropdown";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function DesktopHeader() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");

    // Debounce search update
    useEffect(() => {
        const timer = setTimeout(() => {
            const current = new URLSearchParams(Array.from(searchParams.entries()));
            
            if (searchTerm) {
                current.set("q", searchTerm);
            } else {
                current.delete("q");
            }

            const search = current.toString();
            const query = search ? `?${search}` : "";

            // Only push if changed
            if (searchParams.get("q") !== searchTerm && (searchTerm !== "" || searchParams.has("q"))) {
                 router.push(`${pathname}${query}`);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, router, pathname, searchParams]);

	return (
		<header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-serene-neutral-200/60 transition-all duration-200">
			<div className="flex items-center px-6 lg:px-8 gap-4">
                
                {/* Search & Notifications Group - Centered */}
				<div className="hidden md:flex items-center gap-3 flex-1 max-w-2xl mx-auto">
                    {/* Search Input - Pill Shape */}
					<div className="relative flex-1 max-w-md group mx-auto">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400 group-focus-within:text-serene-blue-500 transition-colors" />
						<Input
							type="search"
							placeholder="Search professionals, services, cases..."
							className={cn(
                                "pl-10 h-10 w-full rounded-full transition-all duration-300",
                                "bg-serene-neutral-50/50 border-serene-neutral-200/60",
                                "focus-visible:bg-white focus-visible:border-serene-blue-200 focus-visible:ring-4 focus-visible:ring-serene-blue-50",
                                "placeholder:text-serene-neutral-400"
                            )}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

                    {/* Notification Bell - Next to search */}
                    <NotificationDropdown />
				</div>
			</div>
		</header>
	);
}
