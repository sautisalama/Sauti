"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  MessageCircle, 
  FileText, 
  LayoutDashboard, 
  ClipboardList, 
  Calendar, 
  Heart, 
  TrendingUp, 
  Users, 
  Shield, 
  Building2 
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
  const searchParams = useSearchParams();
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

  // Check query params for chat ID
  const chatId = searchParams.get('id');
  const isChat = pathname?.startsWith("/dashboard/chat");
  const isChatDetail = isChat && !!chatId; // If /dashboard/chat AND ?id=... exists
  
  const profile = dash?.data?.profile || user?.profile;
  const hasAcceptedPolicies = !!(profile?.settings as any)?.all_policies_accepted;
  const needsOnboarding = !profile?.user_type || 
    !hasAcceptedPolicies ||
    ((profile.user_type === 'professional' || profile.user_type === 'ngo') && !profile.professional_title);

  // Hide on immersive views unless forced to show
  // ... and always hide during onboarding
  const hide = forceShow ? false : (
    needsOnboarding ||
    // Hide ONLY on chat detail page (either by UUID path OR by query param)
    isChatDetail || 
    (pathname?.startsWith("/dashboard/chat/") && pathname !== "/dashboard/chat") || // Fallback for uuid path
    pathname?.includes("/appointment/")
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

    const userRole = dash?.data?.userType || user?.profile?.user_type;
    const isProfessional = userRole === 'professional' || userRole === 'ngo';
    const isAdmin = user?.profile?.is_admin || false; // Check admin status
    
    // Admin Navigation
    if (isAdmin) {
        return [
            { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard/admin" },
            { 
                id: "verification", 
                label: "Verify", 
                icon: Shield, 
                href: "/dashboard/admin/review", // Assuming this is the verifications list page
                badge: dash?.data?.verification?.pendingCount || undefined
            },
            { id: "professionals", label: "Professionals", icon: Users, href: "/dashboard/admin/professionals" },
            { id: "services", label: "Services", icon: Building2, href: "/dashboard/admin/services" },
            { id: "chat", label: "Chats", icon: MessageCircle, href: "/dashboard/chat", badge: unreadMessages > 0 ? unreadMessages : undefined },
        ];
    }

    // Professional: Home, Cases, Chats, Resources
    // Survivor: Home, Reports, Chats, Resources
    
    return [
      { id: "home", label: "Home", icon: LayoutDashboard, href: "/dashboard" },
      isProfessional 
        ? { id: "cases", label: "Cases", icon: ClipboardList, href: "/dashboard/cases", badge: casesCount > 0 ? casesCount : undefined }
        : { id: "reports", label: "Reports", icon: ClipboardList, href: "/dashboard/reports" },
      { id: "chat", label: "Chats", icon: MessageCircle, href: "/dashboard/chat", badge: unreadMessages > 0 ? unreadMessages : undefined },
      { id: "learn", label: "Learn", icon: FileText, href: "/dashboard/resources" },
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

    // Simplified without complex disabled logic for now to match request cleanliness
    
    const content = (
      <div 
        className={cn(
          "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-300", 
          active ? "text-serene-blue-700" : "text-serene-neutral-400 bg-transparent"
        )}
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
          "text-[10px] font-bold leading-none tracking-wide transition-colors mt-1",
          active ? "text-serene-blue-700" : "text-serene-neutral-500"
        )}>
          {item.label}
        </span>
      </div>
    );

    return (
      <Link href={item.href} className="flex-1 flex justify-center">
        {content}
      </Link>
    );
  };

  if (hide || !isDashboard) return null;

  return (
    <div className="lg:hidden fixed bottom-6 left-4 right-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-serene-neutral-200/60 p-2 flex justify-around items-center">
          {navItems.map((item) => (
             <NavItemComponent key={item.id} item={item} />
          ))}
      </div>
    </div>
  );
}
