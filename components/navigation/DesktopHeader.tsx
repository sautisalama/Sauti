"use client";

import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/db-schema";

export function DesktopHeader() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
	const [notifications, setNotifications] = useState<Database['public']['Tables']['notifications']['Row'][]>([]);
    const unreadCount = notifications.filter(n => !n.read).length;
    const supabase = createClientComponentClient<Database>();

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

    // Fetch Notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (data) setNotifications(data);
        };

        fetchNotifications();

        // Optional: Subscribe to realtime (omitted for brevity unless requested)
    }, [supabase]);


	return (
		<header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-serene-neutral-200/60 transition-all duration-200">
			<div className="flex h-16 items-center px-6 lg:px-8 gap-4">
                
                {/* Search & Notifications Group - Centered */}
				<div className="flex items-center gap-3 flex-1 max-w-2xl mx-auto">
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500 hover:text-serene-blue-600 transition-colors h-10 w-10">
                                <Bell className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-sauti-orange ring-2 ring-white animate-pulse" />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80 rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl mt-2">
                            <DropdownMenuLabel className="flex items-center justify-between p-4 pb-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-serene-neutral-900">Notifications</span>
                                    <span className="text-xs text-serene-neutral-400 font-normal">Recent updates</span>
                                </div>
                                {unreadCount > 0 && <Badge variant="secondary" className="bg-sauti-orange/10 text-sauti-orange hover:bg-sauti-orange/20 text-xs border-0">{unreadCount} New</Badge>}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-serene-neutral-100" />
                            {notifications.length === 0 ? (
                                <div className="py-12 text-center text-sm text-serene-neutral-500">
                                    <div className="h-12 w-12 rounded-full bg-serene-neutral-50 flex items-center justify-center mx-auto mb-3">
                                        <Bell className="h-6 w-6 text-serene-neutral-300" />
                                    </div>
                                    <p className="font-medium text-serene-neutral-600">All caught up!</p>
                                    <p className="text-xs mt-1">No new notifications</p>
                                </div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                    {notifications.map((notification) => (
                                        <DropdownMenuItem 
                                            key={notification.id} 
                                            className={cn(
                                                "cursor-pointer p-3 rounded-xl transition-colors mb-1",
                                                !notification.read ? "bg-serene-blue-50/50 hover:bg-serene-blue-50" : "hover:bg-serene-neutral-50"
                                            )}
                                        >
                                            <div className="flex flex-col gap-1 w-full relative">
                                                {!notification.read && (
                                                    <span className="absolute -left-1 top-1.5 h-1.5 w-1.5 rounded-full bg-sauti-blue" />
                                                )}
                                                <span className={cn("text-sm text-serene-neutral-900 pr-4", !notification.read ? "font-semibold" : "font-medium")}>
                                                    {notification.title || (notification.type === 'verification_verified' ? 'Verification Approved' : 
                                                     notification.type === 'verification_rejected' ? 'Verification Rejected' : 
                                                     notification.type === 'verification_suspended' ? 'Account Suspended' : 'Update')}
                                                </span>
                                                <span className="text-xs text-serene-neutral-500 line-clamp-2 leading-relaxed">
                                                    {notification.message}
                                                </span>
                                                <span className="text-[10px] text-serene-neutral-400 mt-1">
                                                    {notification.created_at 
                                                        ? new Date(notification.created_at).toLocaleDateString() 
                                                        : 'Just now'}
                                                </span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            )}
                            <DropdownMenuSeparator className="bg-serene-neutral-100" />
                            <DropdownMenuItem className="p-3 justify-center text-xs text-serene-blue-600 font-bold cursor-pointer hover:text-serene-blue-700 hover:bg-serene-blue-50/50 rounded-b-xl my-1 mx-2">
                                View All Notifications
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
				</div>
			</div>
		</header>
	);
}
