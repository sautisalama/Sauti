"use client";

import { Bell } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Database } from "@/types/db-schema";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/notification-actions";

export function NotificationDropdown() {
    const router = useRouter();
	const [notifications, setNotifications] = useState<Database['public']['Tables']['notifications']['Row'][]>([]);
    const unreadCount = notifications.filter(n => !n.read).length;
    const supabase = createClient();

    // Fetch Notifications
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

    useEffect(() => {
        fetchNotifications();

        // Subscribe to changes
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications'
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleNotificationClick = async (notification: Database['public']['Tables']['notifications']['Row']) => {
        if (!notification.read) {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
            try {
                await markNotificationAsRead(notification.id);
            } catch (err) {
                console.error("Failed to mark as read", err);
            }
        }
        
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const handleMarkAllRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            await markAllNotificationsAsRead();
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

	return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500 hover:text-serene-blue-600 transition-colors h-10 w-10">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-sauti-orange ring-2 ring-white animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl mt-2">
                <DropdownMenuLabel className="flex items-center justify-between p-4 pb-2">
                    <div className="flex flex-col">
                        <span className="font-bold text-serene-neutral-900">Notifications</span>
                        <span className="text-xs text-serene-neutral-400 font-normal">Recent updates</span>
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] text-sauti-blue hover:text-sauti-blue-dark hover:bg-sauti-blue/10 px-2 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAllRead();
                            }}
                        >
                            Mark all read
                        </Button>
                    )}
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
                                onClick={() => handleNotificationClick(notification)}
                            >
                                <div className="flex flex-col gap-1 w-full relative">
                                    {!notification.read && (
                                        <span className="absolute -left-1 top-1.5 h-1.5 w-1.5 rounded-full bg-sauti-blue" />
                                    )}
                                    <span className={cn("text-sm text-serene-neutral-900 pr-4", !notification.read ? "font-semibold" : "font-medium")}>
                                        {notification.title || (notification.type === 'verification_verified' ? 'Verification Approved' : 
                                            notification.type === 'verification_rejected' ? 'Verification Rejected' : 
                                            notification.type === 'account_banned' ? 'Account Suspended' : 'Update')}
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
                <DropdownMenuItem className="p-3 justify-center text-xs text-serene-blue-600 font-bold cursor-pointer hover:text-serene-blue-700 hover:bg-serene-blue-50/50 rounded-b-xl my-1 mx-2" onClick={() => router.push('/dashboard/notifications')}>
                    View All Notifications
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
	);
}
