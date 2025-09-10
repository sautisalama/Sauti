"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  MessageCircle, 
  FileText, 
  LayoutDashboard
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("");

  // Hide on immersive views unless forced to show
  const hide = forceShow ? false : (
    pathname?.startsWith("/dashboard/chat/") ||
    pathname?.includes("/appointment/")
  );

  const isDashboard = pathname?.startsWith("/dashboard");

  // Mock data - replace with real data fetching
  useEffect(() => {
    // Simulate unread messages count
    setUnreadMessages(3);
  }, []);

  // Navigation: keep it ultra-simple on mobile: Overview, Chat, Resources
  const getNavItems = (): NavItem[] => {
    if (!isDashboard) return [];

    return [
      { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
      { id: "chat", label: "Chat", icon: MessageCircle, href: "/dashboard/chat", badge: unreadMessages },
      { id: "resources", label: "Resources", icon: FileText, href: "/dashboard/resources" },
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


    const content = (
      <div 
        className={cn(
          "flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200",
          "hover:bg-white/10 active:scale-95",
          active ? "text-sauti-orange" : "text-neutral-400 dark:text-neutral-500"
        )}
      >
        <div className="relative">
          <Icon className={cn("h-5 w-5", active && "text-sauti-orange")} />
          {item.badge && item.badge > 0 && (
            <Badge 
              className={cn(
                "absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]",
                "bg-error-500 text-white border-2 border-white dark:border-neutral-900"
              )}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
        <span className={cn(
          "text-[10px] font-medium leading-none",
          active ? "text-sauti-orange" : "text-neutral-500 dark:text-neutral-400"
        )}>
          {item.label}
        </span>
      </div>
    );

    return (
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
          "md:hidden fixed bottom-0 left-0 right-0 z-50",
          "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl",
          "border-t border-neutral-200 dark:border-neutral-800",
          "pb-safe-bottom",
          className
        )}
      >
        <div className="px-2 pt-2 pb-2">
          <nav className="grid grid-cols-3 items-end">
            {navItems.map((item) => (
              <NavItemComponent key={item.id} item={item} />
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
