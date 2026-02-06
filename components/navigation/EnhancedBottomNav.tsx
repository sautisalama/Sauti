"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  MessageCircle, 
  FileText, 
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Heart,
  TrendingUp,
  Users
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

interface EnhancedBottomNavProps {
  forceShow?: boolean;
  className?: string;
}

export function EnhancedBottomNav({ forceShow = false, className }: EnhancedBottomNavProps) {
  const pathname = usePathname();
  const user = useUser();
  const dash = useDashboardData();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [casesCount, setCasesCount] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("");
  const [chatActive, setChatActive] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        setChatActive(!!(ce?.detail?.active));
      } catch {}
    };
    window.addEventListener('ss:chat-active', handler as EventListener);
    return () => window.removeEventListener('ss:chat-active', handler as EventListener);
  }, []);

  // Hide on immersive views unless forced to show
  const hide = forceShow ? false : (
    pathname?.startsWith("/dashboard/chat/") ||
    pathname?.includes("/appointment/") ||
    chatActive
  );

  const isDashboard = pathname?.startsWith("/dashboard");

  // Use provider unread count when available
  useEffect(() => {
    if (typeof dash?.data?.unreadChatCount === 'number') {
      setUnreadMessages(dash.data.unreadChatCount);
    }
  }, [dash?.data?.unreadChatCount]);

  useEffect(() => {
    if (typeof dash?.data?.casesCount === 'number') {
      setCasesCount(dash.data.casesCount);
      return;
    }
    const loadCases = async () => {
      try {
        if (user?.profile?.user_type !== 'professional' && user?.profile?.user_type !== 'ngo') {
          setCasesCount(0);
          return;
        }
        const uid = user?.id;
        if (!uid) return;
        const supabase = (await import("@/utils/supabase/client")).createClient();
        const { data: services } = await supabase.from('support_services').select('id').eq('user_id', uid);
        const ids = (services || []).map((s: any) => s.id);
        if (ids.length === 0) { setCasesCount(0); return; }
        const { count } = await supabase.from('matched_services').select('id', { count: 'exact', head: true }).in('service_id', ids);
        setCasesCount(count || 0);
      } catch {
        // ignore
      }
    };
    loadCases();
  }, [dash?.data, user?.id, user?.profile?.user_type]);

  // Navigation: role-aware mobile nav
  const getNavItems = (): NavItem[] => {
    if (!isDashboard) return [];

    const role = user?.profile?.user_type;
    const proRestricted = typeof window !== 'undefined' && window.localStorage.getItem('ss_pro_restricted') === '1';
    if ((role === "professional" || role === "ngo") && !proRestricted) {
      // Professionals: prioritize cases
      return [
        { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
        { id: "cases", label: "Cases", icon: ClipboardList, href: "/dashboard/cases", badge: (casesCount > 0 ? casesCount : undefined) },
        { id: "schedule", label: "Schedule", icon: Calendar, href: "/dashboard/appointments" },
        { id: "chat", label: "Chat", icon: MessageCircle, href: "/dashboard/chat", badge: (unreadMessages > 0 ? unreadMessages : undefined) },
        { id: "resources", label: "Resources", icon: FileText, href: "/dashboard/resources" },
      ];
    }

    // Survivors: Premium layout with 5 keys
    return [
      { id: "home", label: "Home", icon: LayoutDashboard, href: "/dashboard" },
      { id: "cases", label: "My Cases", icon: ClipboardList, href: "/dashboard/reports" },
      { id: "matches", label: "Matches", icon: Heart, href: "/dashboard/matches" }, // Assuming matches route exists or will be created/mapped
      { id: "activity", label: "Activity", icon: TrendingUp, href: "/dashboard/activity", badge: (unreadMessages > 0 ? unreadMessages : undefined) }, // Mapping chat/badge here for now or separate
      { id: "profile", label: "Profile", icon: Users, href: "/dashboard/profile" },
    ];
  };

  const navItems = getNavItems();

  const isActive = (item: NavItem) => {
    if (!item.href) return false;
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(item.href);
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item);

    const role = user?.profile?.user_type;
    const verified = typeof window !== 'undefined' && window.localStorage.getItem('ss_pro_verified') === '1';
    const isPro = role === 'professional' || role === 'ngo';
    const disabled = isPro && !verified && (item.id === 'cases' || item.id === 'schedule');

    const content = (
      <div 
        className={cn(
          "flex flex-col items-center gap-1.5 py-2 px-3 rounded-2xl transition-all duration-300", // Increased gap, rounded-2xl
          disabled ? "opacity-50" : "hover:bg-serene-neutral-50 active:scale-95",
          active ? "text-serene-blue-700 bg-serene-blue-50" : "text-serene-neutral-400 bg-transparent" // Updated colors
        )}
        aria-disabled={disabled}
      >
        <div className="relative">
          <Icon className={cn("h-6 w-6 transition-all duration-300", active && "text-serene-blue-600 scale-100 stroke-[2.5px]")} /> 
          {item.badge && item.badge > 0 && (
            <Badge 
              className={cn(
                "absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center p-0 text-[9px] font-bold shadow-sm",
                "bg-serene-red-500 text-white border border-white min-w-[16px]"
              )}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
        <span className={cn(
          "text-[10px] font-bold leading-none tracking-wide transition-colors",
          active ? "text-serene-blue-700" : "text-serene-neutral-500"
        )}>
          {item.label}
        </span>
      </div>
    );

    return disabled ? (
      <div className="flex-1 pointer-events-none">
        {content}
      </div>
    ) : (
      <Link href={item.href} className="flex-1">
        {content}
      </Link>
    );
  };

  if (hide || !isDashboard) return null;

  return (
    <>
      <div
        className={cn(
          "lg:hidden fixed bottom-6 left-4 right-4 z-50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]", // Floating island style
          "bg-white/90 backdrop-blur-2xl ring-1 ring-white/20",
          "pb-0", // Remove safe-bottom padding as it's floating
          className
        )}
      >
        <div className="px-2 pt-2 pb-2">
          <nav
            className={cn(
              "grid items-end",
              navItems.length === 5 && "grid-cols-5",
              navItems.length === 4 && "grid-cols-4",
              navItems.length <= 3 && "grid-cols-3"
            )}
          >
            {navItems.map((item) => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
