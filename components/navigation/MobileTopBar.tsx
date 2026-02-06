"use client";

import { useUser } from "@/hooks/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, Shield } from "lucide-react";
import { signOut } from "@/app/(auth)/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function MobileTopBar() {
  const user = useUser();
  const pathname = usePathname();
  const names = `${user?.profile?.first_name || ""} ${user?.profile?.last_name || ""}`.trim() || user?.email || "User";
  const initials = names.charAt(0).toUpperCase();

  // Hide on desktop (lg hidden)
  // Hide on chat pages (both list and detail) as requested
  const isChat = pathname?.startsWith("/dashboard/chat");
  if (isChat) return null;

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-serene-neutral-200 px-4 py-3 flex items-center justify-between shadow-sm transition-all duration-300">
      
      {/* Brand / Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
         {/* Using text for now or simple icon if image not available */}
         <div className="h-8 w-8 bg-serene-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
           S
         </div>
         <span className="font-bold text-lg text-serene-neutral-900 tracking-tight">Sauti Salama</span>
      </Link>

      {/* User Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-transparent focus-visible:ring-0">
            <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-2 ring-serene-neutral-100 transition-transform active:scale-95">
              <AvatarImage src={user?.profile?.avatar_url || ""} />
              <AvatarFallback className="bg-gradient-to-br from-serene-blue-500 to-serene-blue-600 text-white font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 mt-2 mr-2 rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-serene-neutral-900">{names}</p>
              <p className="text-xs leading-none text-serene-neutral-500 truncate">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-serene-neutral-100" />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile" className="cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          {user?.profile?.user_type === "professional" && (
             <DropdownMenuItem asChild>
                <Link href="/dashboard/verification" className="cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600">
                  <Shield className="mr-2 h-4 w-4 text-serene-blue-500" />
                  <span>Verification</span>
                </Link>
             </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-serene-neutral-100" />
          <DropdownMenuItem 
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 rounded-xl"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
