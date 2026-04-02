"use client";

import { Bell, Search, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationDropdown } from "./NotificationDropdown";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DesktopHeader({ 
    showSearch = true,
    showNotifications = true
}: { 
    showSearch?: boolean;
    showNotifications?: boolean;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");

    // Show back button on all pages except main dashboard
    const showBack = pathname !== "/dashboard";

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
		<header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-serene-neutral-200/60 transition-all duration-200 h-16 flex items-center shrink-0">
			<div className="flex items-center px-6 lg:px-8 gap-4 w-full h-full relative">
                
                {showBack && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => router.back()}
                        className="flex items-center gap-1.5 text-serene-neutral-600 hover:text-serene-blue-600 hover:bg-serene-blue-50/50 rounded-xl transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-sm font-semibold hidden sm:inline">Back</span>
                    </Button>
                )}

                {/* Search & Notifications Group - Centered */}
				<div className="flex items-center gap-4 flex-1 max-w-2xl mx-auto">
                    {/* Search Input - Pill Shape */}
					{showSearch && (
                        <div className="relative flex-1 group max-w-md mx-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400 group-focus-within:text-serene-blue-500 transition-colors" />
                            <Input
                                type="search"
                                placeholder="Search..."
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
                    )}

                    {/* Notification Bell - Next to search */}
                    {showNotifications && <NotificationDropdown />}
				</div>
                
                {/* Right side spacer to balance back button */}
                {showBack && <div className="w-[72px] hidden sm:block pointer-events-none" />}
			</div>
		</header>
	);
}
