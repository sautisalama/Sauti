"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  ArrowRight,
  ChevronRight,
  Star,
  Calendar,
  MessageCircle,
  Shield,
  FileText,
  Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Serene Welcome Header
interface SereneWelcomeHeaderProps {
  name: string;
  timeOfDay?: "morning" | "afternoon" | "evening";
  className?: string;
  compact?: boolean;
}

export function SereneWelcomeHeader({ name, timeOfDay = "morning", className, compact }: SereneWelcomeHeaderProps) {
  const greetings = {
    morning: "Good morning",
    afternoon: "Good afternoon", 
    evening: "Good evening"
  };

  if (compact) {
    return (
      <div className={cn(
        "mb-6",
        className
      )}>
        <h1 className="text-lg font-bold tracking-tight text-serene-neutral-900">
          {greetings[timeOfDay]}, <span className="text-serene-blue-600">{name}</span>
        </h1>
        <p className="text-serene-neutral-600 font-medium leading-relaxed">
          Welcome back, you're safe here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-6 md:p-8 bg-gradient-to-br from-serene-blue-50 to-white rounded-3xl mb-8 relative overflow-hidden shadow-sm border border-serene-blue-100 transition-all duration-500",
      className
    )}>
      {/* Soft decorative blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-serene-blue-200/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        <h1 className="text-3xl lg:text-4xl font-bold mb-2 tracking-tight text-serene-neutral-900">
          {greetings[timeOfDay]}, <span className="text-serene-blue-600">{name}</span>
        </h1>
        <p className="text-serene-neutral-600 text-lg font-medium leading-relaxed">
          Welcome back, you're safe here.
        </p>
      </div>
    </div>
  );
}

// Serene Breadcrumb
interface SereneBreadcrumbItem {
  label: string;
  href?: string;
}

interface SereneBreadcrumbProps {
  items: SereneBreadcrumbItem[];
  className?: string;
}

export function SereneBreadcrumb({ items, className }: SereneBreadcrumbProps) {
  return (
    <nav className={cn("flex items-center space-x-2 text-sm text-serene-neutral-500 mb-6", className)}>
      <Link href="/dashboard" className="hover:text-serene-blue-600 transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="h-3 w-3 text-serene-neutral-300" />
          {item.href ? (
             <Link href={item.href} className="hover:text-serene-blue-600 transition-colors font-medium">
               {item.label}
             </Link>
          ) : (
             <span className="text-serene-neutral-900 font-semibold cursor-default">
               {item.label}
             </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Serene Quick Action Card
interface SereneQuickActionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  badge?: number | string;
  variant?: "blue" | "green" | "neutral";
  className?: string;
}

export function SereneQuickActionCard({ 
  icon, 
  title, 
  description, 
  href, 
  onClick, 
  badge, 
  variant = "blue",
  className 
}: SereneQuickActionProps) {
  const variants = {
    blue: "bg-serene-blue-50 hover:bg-serene-blue-100 text-serene-blue-900",
    green: "bg-serene-green-50 hover:bg-serene-green-100 text-serene-green-700",
    neutral: "bg-serene-neutral-50 hover:bg-serene-neutral-100 text-serene-neutral-900"
  };

  const iconColors = {
    blue: "text-serene-blue-600 bg-white/60",
    green: "text-serene-green-500 bg-white/60",
    neutral: "text-serene-neutral-600 bg-white/60"
  };

  const content = (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
      "cursor-pointer border border-transparent hover:border-serene-blue-200/50 shadow-sm hover:shadow-md",
      variants[variant],
      className
    )}>
      {badge && (
        <Badge className="absolute top-3 right-3 bg-serene-blue-600 text-white border-0 font-medium px-1.5 py-0.5 text-xs">
          {badge}
        </Badge>
      )}
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl transition-colors duration-300", iconColors[variant])}>
            {icon}
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-base mb-1 tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs leading-relaxed opacity-80 font-medium">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full">{content}</Link>;
  }

  return <button onClick={onClick} className="block w-full text-left h-full">{content}</button>;
}

// Serene Stats Card
interface SereneStatsCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export function SereneStatsCard({ 
  title, 
  value, 
  icon, 
  description, 
  className 
}: SereneStatsCardProps) {
  return (
    <Card className={cn("overflow-hidden border-serene-neutral-200 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-serene-neutral-400">
            {title}
          </h3>
          {icon && (
            <div className="text-serene-blue-500 bg-serene-blue-50 p-2 rounded-lg">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-serene-neutral-900">
            {value}
          </span>
        </div>

        {description && (
          <p className="text-xs text-serene-neutral-500 font-medium">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Serene Section Header
interface SereneSectionHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function SereneSectionHeader({ title, description, action, className }: SereneSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2", className)}>
      <div>
        <h2 className="text-xl font-bold text-serene-neutral-900 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm font-medium text-serene-neutral-500 mt-1">
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <Button 
          variant="ghost" 
          size="sm"
          className="text-serene-blue-600 hover:text-serene-blue-700 hover:bg-serene-blue-50 -ml-3 sm:ml-0 w-fit"
          onClick={action.onClick}
          asChild={!!action.href}
        >
          {action.href ? (
            <Link href={action.href} className="flex items-center gap-1">
              {action.label} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex items-center gap-1">
               {action.label} <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      )}
    </div>
  );
}

// Serene Provider Card (Matches)
interface SereneProviderCardProps {
  provider: {
    name: string;
    role: string;
    organization?: string;
    rating?: number;
    avatarUrl?: string;
    matchScore?: number;
    matchStatus?: 'pending' | 'accepted' | 'declined';
  };
  onBook?: () => void;
  onChat?: () => void;
  className?: string;
}

export function SereneProviderCard({ provider, onBook, onChat, className }: SereneProviderCardProps) {
  return (
    <Card className={cn("overflow-hidden border-serene-neutral-200 rounded-3xl shadow-sm hover:shadow-md transition-all", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
             <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                <AvatarImage src={provider.avatarUrl} />
                <AvatarFallback className="bg-serene-blue-100 text-serene-blue-700 font-semibold">
                  {provider.name.charAt(0)}
                </AvatarFallback>
             </Avatar>
             <div>
               <h3 className="font-bold text-serene-neutral-900">{provider.name}</h3>
               <p className="text-xs font-medium text-serene-neutral-500">{provider.role} {provider.organization && `• ${provider.organization}`}</p>
               <div className="flex items-center gap-1 mt-1">
                 <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                 <span className="text-xs font-bold text-serene-neutral-700">{provider.rating || "New"}</span>
               </div>
             </div>
          </div>
          {provider.matchScore && (
             <Badge variant="outline" className="bg-serene-green-50 text-serene-green-700 border-serene-green-200">
               {provider.matchScore}% Match
             </Badge>
          )}
        </div>
        
        <div className="mt-6 flex gap-3">
           <Button 
             className="flex-1 bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl h-10 text-sm font-semibold shadow-sm"
             onClick={onBook}
           >
             <Calendar className="h-4 w-4 mr-2" /> Book Now
           </Button>
           <Button 
             variant="outline"
             className="flex-1 border-serene-neutral-200 hover:bg-serene-neutral-50 text-serene-neutral-700 rounded-xl h-10 text-sm font-semibold"
             onClick={onChat}
           >
             <MessageCircle className="h-4 w-4 mr-2" /> Chat
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Serene Report List Card
interface SereneReportCardProps {
  type: string;
  date: string;
  description: string;
  status: 'pending' | 'matched' | 'resolved';
  urgency: 'high' | 'medium' | 'low';
  matchesCount?: number;
  unreadMessages?: number;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}

export function SereneReportCard({ 
  type, 
  date, 
  description, 
  status, 
  urgency, 
  matchesCount = 0,
  unreadMessages = 0,
  onClick, 
  className, 
  active 
}: SereneReportCardProps) {
  const urgencyColors = {
    high: "bg-red-50 text-red-600 border-red-100",
    medium: "bg-amber-50 text-amber-600 border-amber-100",
    low: "bg-blue-50 text-blue-600 border-blue-100"
  };

  const statusColors = {
    pending: "text-gray-500",
    matched: "text-serene-green-600",
    resolved: "text-serene-blue-600"
  };

  return (
    <div 
       onClick={onClick}
       className={cn(
         "group relative p-5 bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
         active 
            ? "border-serene-blue-400 ring-4 ring-serene-blue-50 shadow-md z-10" 
            : "border-serene-neutral-100 hover:border-serene-blue-200 hover:shadow-lg hover:-translate-y-0.5",
         className
       )}
    >
      {unreadMessages > 0 && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-serene-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-serene-blue-500"></span>
        </span>
      )}

      <div className="flex items-start justify-between mb-4">
         <div className="flex items-center gap-4">
           <div className={cn(
             "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors duration-300 border border-white shadow-sm",
             active ? "bg-serene-blue-600 text-white" : "bg-serene-neutral-50 text-serene-neutral-500 group-hover:bg-serene-blue-50 group-hover:text-serene-blue-600"
           )}>
              <Shield className="h-6 w-6" />
           </div>
           <div>
             <h4 className="font-bold text-serene-neutral-900 group-hover:text-serene-blue-900 transition-colors text-base">{type}</h4>
             <span className="text-xs text-serene-neutral-500 font-medium flex items-center gap-1.5 mt-0.5">
               <Clock className="h-3.5 w-3.5" /> {date}
             </span>
           </div>
         </div>
         <Badge variant="outline" className={cn("border-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg", urgencyColors[urgency])}>
           {urgency}
         </Badge>
      </div>
      
      <div className="pl-[64px]">
        <p className="text-sm text-serene-neutral-600 line-clamp-2 mb-4 leading-relaxed font-medium">
          {description || "No description provided."}
        </p>

        <div className="flex items-center justify-between pt-2 border-t border-serene-neutral-50">
          <div className="flex items-center gap-3">
            {matchesCount > 0 ? (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-serene-green-50 text-serene-green-700 border border-serene-green-100 text-[10px] font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-serene-green-500" />
                  {matchesCount} Match{matchesCount !== 1 ? 'es' : ''}
               </div>
            ) : status === 'pending' ? (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-serene-neutral-50 text-serene-neutral-500 border border-serene-neutral-100 text-[10px] font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-serene-neutral-400" />
                  Pending
               </div>
            ) : null}

            {unreadMessages > 0 && (
               <span className="text-xs font-bold text-serene-blue-600 flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {unreadMessages}
               </span>
            )}
          </div>
          
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-serene-neutral-300 group-hover:text-serene-blue-600 group-hover:bg-serene-blue-50 transition-all">
             <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Serene Activity Item
interface SereneActivityItemProps {
  title: string;
  description: string;
  time: string;
  icon?: ReactNode;
  isUnread?: boolean;
  className?: string;
}

export function SereneActivityItem({ title, description, time, icon, isUnread, className }: SereneActivityItemProps) {
  return (
    <div className={cn(
      "flex gap-4 p-4 rounded-2xl transition-all duration-200",
      isUnread ? "bg-serene-blue-50/50" : "bg-white hover:bg-serene-neutral-50",
      className
    )}>
       <div className={cn(
         "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
         isUnread ? "bg-white text-serene-blue-600 border border-serene-blue-100" : "bg-serene-neutral-100 text-serene-neutral-500" 
       )}>
          {icon || <FileText className="h-5 w-5" />}
       </div>
       <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
             <h4 className={cn("text-sm font-bold truncate", isUnread ? "text-serene-blue-900" : "text-serene-neutral-900")}>
               {title}
             </h4>
             <span className="text-[10px] font-medium text-serene-neutral-400 whitespace-nowrap ml-2">
               {time}
             </span>
          </div>
          <p className={cn("text-xs leading-relaxed line-clamp-2", isUnread ? "text-serene-blue-700/80" : "text-serene-neutral-500")}>
            {description}
          </p>
       </div>
       {isUnread && (
         <div className="w-2 h-2 bg-serene-blue-500 rounded-full self-center ml-2 shrink-0" />
       )}
    </div>
  );
}

// Serene Appointment Card
interface SereneAppointmentCardProps {
  date: Date;
  title: string;
  providerName: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  onAction?: () => void;
  className?: string;
}

export function SereneAppointmentCard({ date, title, providerName, status, onAction, className }: SereneAppointmentCardProps) {
  const isUpcoming = status === 'upcoming';
  
  return (
    <Card className={cn("overflow-hidden border-serene-neutral-200 rounded-3xl shadow-sm hover:shadow-md transition-all", className)}>
      <CardContent className="p-0 flex flex-col sm:flex-row">
         {/* Calendar Date Block */}
         <div className={cn(
           "p-4 sm:w-24 flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-0",
           isUpcoming ? "bg-serene-blue-50/50" : "bg-serene-neutral-50"
         )}>
            <span className="text-xs font-bold uppercase text-serene-neutral-500">
               {date.toLocaleString('default', { month: 'short' })}
            </span>
            <span className={cn("text-2xl font-bold", isUpcoming ? "text-serene-blue-600" : "text-serene-neutral-700")}>
               {date.getDate()}
            </span>
            <span className="text-xs text-serene-neutral-400 hidden sm:block">
               {date.toLocaleString('default', { weekday: 'short' })}
            </span>
         </div>
         
         {/* Content */}
         <div className="flex-1 p-4 flex flex-col justify-center">
            <div className="flex items-start justify-between mb-2">
               <div>
                  <h4 className="font-bold text-serene-neutral-900 text-base">{title}</h4>
                   <p className="text-xs text-serene-neutral-500 font-medium mt-0.5">with {providerName}</p>
               </div>
               <Badge variant={isUpcoming ? "default" : "secondary"} className={cn("capitalize shadow-none", isUpcoming ? "bg-serene-blue-600" : "bg-serene-neutral-100 text-serene-neutral-600")}>
                  {status}
               </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-serene-neutral-500 mt-2">
               <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
               {isUpcoming && onAction && (
                  <Button variant="link" onClick={onAction} className="ml-auto h-auto p-0 text-serene-blue-600 font-semibold px-0 text-xs">
                     View Details <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
               )}
            </div>
         </div>
      </CardContent>
    </Card>
  )
}
