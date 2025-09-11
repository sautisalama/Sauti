"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MobileProfileButton() {
  const user = useUser();
  const pathname = usePathname();

  // Hide on desktop, and optionally hide when already on profile page
  const hide = pathname?.startsWith("/dashboard/profile");
  if (hide) return null;

  const isAnon = typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1";

  return (
    <Link
      href="/dashboard/profile"
      aria-label="Open profile"
      className="md:hidden fixed top-3 right-3 z-50 rounded-full border border-neutral-200/60 dark:border-neutral-800/60 bg-white/70 dark:bg-neutral-900/60 backdrop-blur px-1.5 py-1.5 shadow-sm hover:shadow transition-shadow"
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={isAnon ? "/anon.svg" : (user?.profile?.avatar_url || "")} />
          <AvatarFallback className="text-[11px]">
            {user?.profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </Link>
  );
}

