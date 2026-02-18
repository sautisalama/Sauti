"use client";

import { Bell, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info, Clock, ArrowRight, Trash2 } from "lucide-react";
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
            .limit(15); // Increased limit slightly for better history view
        
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

    // --- Format Helpers ---

    const getIcon = (type: string) => {
        if (type.includes('verified') || type.includes('approved')) return <CheckCircle className="h-5 w-5 text-green-600" />;
        if (type.includes('rejected')) return <XCircle className="h-5 w-5 text-red-600" />;
        if (type.includes('banned') || type.includes('suspended')) return <AlertTriangle className="h-5 w-5 text-amber-600" />;
        if (type.includes('review') || type.includes('pending')) return <Clock className="h-5 w-5 text-blue-600" />;
        if (type.includes('match')) return <ArrowRight className="h-5 w-5 text-sauti-teal" />;
        return <Info className="h-5 w-5 text-serene-neutral-500" />;
    };

    const getBgColor = (type: string) => {
        if (type.includes('verified') || type.includes('approved')) return "bg-green-50 border-green-100";
        if (type.includes('rejected')) return "bg-red-50 border-red-100";
        if (type.includes('banned') || type.includes('suspended')) return "bg-amber-50 border-amber-100";
        if (type.includes('review') || type.includes('pending')) return "bg-blue-50 border-blue-100";
        return "bg-serene-neutral-50 border-serene-neutral-100";
    };

    const formatTimeAgo = (dateString: string | null) => {
        if (!dateString) return 'Just now';
        
        // Hydration stability: don't compute relative time on server
        if (typeof window === 'undefined') return 'Just now';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString(); 
    };

	return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-serene-neutral-100 text-serene-neutral-500 hover:text-serene-blue-600 transition-colors h-10 w-10">
                    <Bell className="h-5 w-5 transition-transform group-active:scale-95" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[380px] rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl mt-2 p-0 overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-white border-b border-serene-neutral-100">
                    <div className="flex flex-col">
                        <span className="font-bold text-serene-neutral-900 text-base">Notifications</span>
                        <span className="text-xs text-serene-neutral-500 font-medium">{unreadCount} unread</span>
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs font-semibold text-sauti-blue hover:text-sauti-blue-dark hover:bg-sauti-blue/10 px-3 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAllRead();
                            }}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                
                {notifications.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="h-16 w-16 rounded-full bg-serene-neutral-50 flex items-center justify-center mx-auto mb-4 border border-serene-neutral-100">
                            <Bell className="h-8 w-8 text-serene-neutral-300" />
                        </div>
                        <p className="font-semibold text-serene-neutral-700">All caught up!</p>
                        <p className="text-xs text-serene-neutral-400 mt-1 max-w-[200px] mx-auto">
                            Check back later for updates on your account and verification.
                        </p>
                    </div>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto scrollbar-hide">
                        {notifications.map((notification) => (
                            <DropdownMenuItem 
                                key={notification.id} 
                                className={cn(
                                    "cursor-pointer p-4 border-b border-serene-neutral-50 transition-all hover:bg-serene-neutral-50 focus:bg-serene-neutral-50 gap-4 items-start relative outline-none",
                                    !notification.read && "bg-serene-blue-50/20"
                                )}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                {/* Left Unread Indicator Strip */}
                                {!notification.read && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-sauti-blue" />
                                )}

                                {/* Icon */}
                                <div className={cn("mt-0.5 h-10 w-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm", getBgColor(notification.type))}>
                                    {getIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-start justify-between gap-3">
                                         <span className={cn("text-sm text-serene-neutral-900 leading-snug truncate pr-2", !notification.read ? "font-bold" : "font-semibold")}>
                                             {notification.title || "Notification"}
                                         </span>
                                         <span className="text-[10px] text-serene-neutral-400 whitespace-nowrap shrink-0 font-medium">
                                             {formatTimeAgo(notification.created_at)}
                                         </span>
                                    </div>
                                    <p className={cn("text-xs text-serene-neutral-600 line-clamp-2 leading-relaxed font-medium")}>
                                        {notification.message}
                                    </p>
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
	);
}
