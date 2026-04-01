"use client";

import { ReactNode, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  ArrowRight,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Star,
  Calendar,
  MessageCircle,
  Shield,
  FileText,
  Home,
  AlertTriangle,
  AlertCircle,
  Users,
  Search,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReportWithRelations, MatchedServiceWithRelations, AppointmentWithDetails } from "../_types";
import { getReportStatus, getStatusTheme, getMatchStatus } from "@/lib/utils/case-status";
import { Tables } from "@/types/db-schema";

// --- Breadcrumbs ---

interface SereneBreadcrumbItem {
  label: string;
  href?: string;
}

export function SereneBreadcrumb({ items, className }: { items: SereneBreadcrumbItem[]; className?: string; }) {
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

// --- Headers & Navigation ---

interface SereneWelcomeHeaderProps {
  name: string;
  timeOfDay?: "morning" | "afternoon" | "evening";
  className?: string;
  compact?: boolean;
  welcomeMessage?: ReactNode;
}

export function SereneWelcomeHeader({ name, timeOfDay = "morning", className, compact, welcomeMessage = "Welcome back, you're safe here." }: SereneWelcomeHeaderProps) {
  const greetings = {
    morning: "Good morning",
    afternoon: "Good afternoon", 
    evening: "Good evening"
  };

  if (compact) {
    return (
      <div className={cn("mb-6", className)}>
        <h1 className="text-lg font-bold tracking-tight text-serene-neutral-900">
          {greetings[timeOfDay]}, <span className="text-serene-blue-600">{name}</span>
        </h1>
        <div className="text-serene-neutral-600 font-medium leading-relaxed">
          {welcomeMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full p-6 md:p-8 bg-gradient-to-br from-serene-blue-50 to-white rounded-2xl mb-8 relative overflow-hidden shadow-sm border border-serene-blue-100 transition-all duration-500",
      className
    )}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-serene-blue-200/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="relative z-10">
        <h1 className="text-3xl lg:text-4xl font-bold mb-2 tracking-tight text-serene-neutral-900">
          {greetings[timeOfDay]}, <span className="text-serene-blue-600">{name}</span>
        </h1>
        <div className="text-serene-neutral-600 text-lg font-medium leading-relaxed">
          {welcomeMessage}
        </div>
      </div>
    </div>
  );
}

export function SereneSectionHeader({ title, description, action, className }: {
    title: string;
    description?: string;
    action?: { label: string; onClick?: () => void; href?: string; };
    className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2", className)}>
      <div>
        <h2 className="text-xl font-bold text-serene-neutral-900 tracking-tight">{title}</h2>
        {description && <p className="text-sm font-medium text-serene-neutral-500 mt-1">{description}</p>}
      </div>
      {action && (
        <Button variant="ghost" size="sm" className="text-serene-blue-600 hover:text-serene-blue-700 hover:bg-serene-blue-50 -ml-3 sm:ml-0 w-fit" onClick={action.onClick} asChild={!!action.href}>
          {action.href ? (
            <Link href={action.href} className="flex items-center gap-1">{action.label} <ArrowRight className="h-4 w-4" /></Link>
          ) : (
            <span className="flex items-center gap-1">{action.label} <ArrowRight className="h-4 w-4" /></span>
          )}
        </Button>
      )}
    </div>
  );
}

// --- Cards & Elements ---

export function SereneQuickActionCard({ 
  icon, title, description, href, onClick, badge, badgeClassName, 
  variant = "blue", className, stats, actionIcon, onActionClick 
}: any) {
  const variants: any = {
    blue: "bg-serene-blue-50 hover:bg-serene-blue-100 text-serene-blue-900",
    green: "bg-serene-green-50 hover:bg-serene-green-100 text-serene-green-700",
    neutral: "bg-serene-neutral-50 hover:bg-serene-neutral-100 text-serene-neutral-900",
    custom: ""
  };

  const content = (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 cursor-pointer border border-transparent hover:border-serene-blue-200/50 shadow-sm hover:shadow-md h-full",
      variants[variant], className
    )}>
      {badge && (
        <Badge className={cn("absolute top-3 right-3 bg-serene-blue-600 text-white border-0 font-medium px-1.5 py-0.5 text-xs", badgeClassName)}>
          {badge}
        </Badge>
      )}
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl transition-colors duration-300 bg-white/60", variant !== "custom" && "text-current")}>
            {icon}
          </div>
          {actionIcon && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onActionClick?.(e); }} className="p-2 rounded-full bg-white/40 hover:bg-white/60 transition-all shadow-sm">
              {actionIcon}
            </button>
          )}
        </div>
        <div>
          <h3 className="font-bold text-base mb-1 tracking-tight">{title}</h3>
          {description && <p className="text-xs leading-relaxed opacity-80 font-medium mb-3">{description}</p>}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href} className="block h-full">{content}</Link> : <button onClick={onClick} className="block w-full text-left h-full">{content}</button>;
}

export function SereneStatsCard({ title, value, icon, trend, trendValue, description, className }: { 
    title: string; 
    value: string | number; 
    icon?: ReactNode; 
    trend?: "up" | "down"; 
    trendValue?: string; 
    description?: string; 
    className?: string; 
}) {
  return (
    <Card className={cn("overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-serene-neutral-500 uppercase tracking-wider">{title}</p>
          {icon && <div className="text-serene-blue-600 bg-serene-blue-50 p-2 rounded-lg">{icon}</div>}
        </div>
        <div className="flex items-end gap-2">
          <h3 className="text-2xl font-bold text-serene-neutral-900">{value}</h3>
          {trend && (
            <div className={cn("flex items-center text-xs font-bold mb-1", trend === "up" ? "text-serene-green-600" : "text-serene-red-600")}>
              {trend === "up" ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trendValue}
            </div>
          )}
        </div>
        {description && <p className="text-xs text-serene-neutral-400 mt-1 font-medium">{description}</p>}
      </CardContent>
    </Card>
  );
}

export function SereneReportCard({ report, onClick, isSelected, className }: { 
    report: ReportWithRelations; 
    onClick?: () => void; 
    isSelected?: boolean; 
    className?: string; 
}) {
  const status = getReportStatus(report);
  const statusTheme = getStatusTheme(status);

  return (
    <Card 
        onClick={onClick}
        className={cn(
            "group relative overflow-hidden transition-all duration-300 cursor-pointer border-serene-neutral-100 hover:border-serene-blue-200 hover:shadow-md",
            isSelected ? "border-serene-blue-600 ring-1 ring-serene-blue-600 shadow-md bg-serene-blue-50/30" : "bg-white",
            className
        )}
    >
        <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-0 px-2 py-0.5", statusTheme)}>
                    {status}
                </Badge>
                <span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest leading-none">
                    {report.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString() : ""}
                </span>
            </div>
            <h4 className={cn("font-bold text-serene-neutral-900 mb-1 line-clamp-1", isSelected ? "text-serene-blue-700" : "")}>
                {report.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
            </h4>
            <p className="text-xs text-serene-neutral-500 line-clamp-2 leading-relaxed mb-3">
                {report.incident_description || "No specific details provided."}
            </p>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-serene-neutral-100 flex items-center justify-center">
                        <MapPin className="h-3 w-3 text-serene-neutral-400" />
                    </div>
                    <span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-tight truncate max-w-[120px]">
                        {report.city || report.state || report.locality || "Region Confidential"}
                    </span>
                </div>
                <ChevronRight className={cn("h-4 w-4 transition-all", isSelected ? "text-serene-blue-600 translate-x-1" : "text-serene-neutral-300 group-hover:text-serene-blue-400 group-hover:translate-x-1")} />
            </div>
        </CardContent>
    </Card>
  );
}

export function SereneProviderCard({ provider, onBook, onChat, className }: {
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
}) {
  return (
    <Card className={cn("overflow-hidden border-serene-neutral-100 rounded-2xl shadow-sm hover:shadow-md transition-all", className)}>
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
           <Button className="flex-1 bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-xl h-10 text-sm font-semibold" onClick={onBook}>
             <Calendar className="h-4 w-4 mr-2" /> Book Now
           </Button>
           <Button variant="outline" className="flex-1 border-serene-neutral-200 hover:bg-serene-neutral-50 text-serene-neutral-700 rounded-xl h-10 text-sm font-semibold" onClick={onChat}>
             <MessageCircle className="h-4 w-4 mr-2" /> Chat
           </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SereneActivityItem({ title, description, time, icon, isUnread, className }: {
  title: string;
  description: string;
  time: string;
  icon?: ReactNode;
  isUnread?: boolean;
  className?: string;
}) {
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
             <h4 className={cn("text-sm font-bold truncate", isUnread ? "text-serene-blue-900" : "text-serene-neutral-900")}>{title}</h4>
             <span className="text-[10px] font-medium text-serene-neutral-400 whitespace-nowrap ml-2">{time}</span>
          </div>
          <p className={cn("text-xs leading-relaxed line-clamp-2", isUnread ? "text-serene-blue-700/80" : "text-serene-neutral-500")}>{description}</p>
       </div>
       {isUnread && <div className="w-2 h-2 bg-serene-blue-500 rounded-full self-center ml-2 shrink-0" />}
    </div>
  );
}
  
export function SereneActivityCard({ report, href, className }: { 
    report: ReportWithRelations; 
    href: string; 
    className?: string; 
}) {
  const status = getReportStatus(report);
  const statusTheme = getStatusTheme(status);

  return (
    <Link href={href} className={cn("block group", className)}>
      <Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 bg-serene-blue-50 text-serene-blue-600">
            {report.type_of_incident?.charAt(0).toUpperCase() || "R"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="font-semibold text-serene-neutral-900 truncate">{report.type_of_incident?.replace(/_/g, " ") || "Incident Report"}</h4>
                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-0 px-1.5 py-0.5", statusTheme)}>{status}</Badge>
              </div>
              <span className="text-xs text-serene-neutral-400 font-medium ml-2">{report.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString() : ""}</span>
            </div>
            <p className="text-sm text-serene-neutral-500 truncate">{report.incident_description || "No description provided."}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-serene-neutral-300 group-hover:text-serene-blue-400" />
        </CardContent>
      </Card>
    </Link>
  );
}

// --- Professional/Unified Components ---

export function VerificationBanner({ profileDetails, supportServices }: { profileDetails: Tables<"profiles">; supportServices: Tables<"support_services">[]; }) {
  const verifiedServices = supportServices.filter(s => s.verification_status === 'verified');
  const reviewServices = supportServices.filter(s => s.verification_status === 'under_review');
  const rejectedServices = supportServices.filter(s => s.verification_status === 'rejected');
  
  const verifiedCount = verifiedServices.length;
  const reviewCount = reviewServices.length;
  const rejectedCount = rejectedServices.length;
  const total = supportServices.length;
  
  const isProfileRejected = profileDetails.verification_status === 'rejected';
  const isProfilePending = profileDetails.verification_status === 'pending' || !profileDetails.verification_status;
  const isProfileUnderReview = profileDetails.verification_status === 'under_review';

  if (total > 0 && verifiedCount === total && !isProfileRejected && !isProfilePending && !isProfileUnderReview) return null;

  let bannerTitle = "Complete your verification";
  let bannerDesc = "Verify your profile to be matched with survivors seeking support.";
  let bannerVariant: "default" | "destructive" | "warning" = "warning";
  let BannerIcon = AlertTriangle;

  if (rejectedCount > 0 || isProfileRejected) {
    bannerTitle = "Action Required: Documents Rejected";
    bannerVariant = "destructive";
    BannerIcon = AlertCircle;
    const reasons = [];
    if (isProfileRejected) reasons.push(profileDetails.verification_notes || "Profile documents rejected.");
    rejectedServices.forEach(s => reasons.push(`Service "${s.name}": ${s.verification_notes || "Documents rejected"}`));
    bannerDesc = reasons.join("\n") || "Please review your documents and resubmit.";
  } else if (isProfilePending) {
    bannerTitle = "Verification Pending";
    bannerDesc = "Please complete your identity verification to proceed.";
  } else if (isProfileUnderReview || reviewCount > 0) {
    bannerTitle = "Verification in Progress";
    bannerDesc = "We are reviewing your documents. This usually takes 24-48 hours.";
    BannerIcon = Clock;
    bannerVariant = "default";
  } else if (total === 0) {
    bannerTitle = "Register your first service";
    bannerDesc = "Add a support service to start helping survivors.";
  }

  return (
    <Alert className={cn(
      "border-0 shadow-sm rounded-2xl p-5 sm:p-6 transition-all duration-300",
      bannerVariant === "destructive" ? "bg-red-50 text-red-900" : 
      bannerVariant === "warning" ? "bg-amber-50 text-amber-900" : "bg-serene-blue-50 text-serene-blue-900"
    )}>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className={cn(
          "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
          bannerVariant === "destructive" ? "bg-red-100 text-red-600" :
          bannerVariant === "warning" ? "bg-amber-100 text-amber-600" : "bg-serene-blue-100 text-serene-blue-600"
        )}>
          <BannerIcon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <AlertTitle className="font-bold text-lg mb-1">{bannerTitle}</AlertTitle>
          <AlertDescription className="text-sm font-medium opacity-80 whitespace-pre-line">
            {bannerDesc}
            <div className="flex flex-wrap gap-3 mt-3">
              <Link href="/dashboard/profile" className="inline-flex items-center text-xs font-bold uppercase tracking-wider hover:underline border-b border-current pb-0.5">
                Go to Profile <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}

export function CalendarWidget({ appointments, upcomingAppointmentsCount }: { appointments: AppointmentWithDetails[]; upcomingAppointmentsCount: number; }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const getAppointmentsForDay = (date: Date) => appointments.filter(a => a.appointment_date && new Date(a.appointment_date).toDateString() === date.toDateString());
  const selectedDayAppointments = getAppointmentsForDay(selectedDate);

  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [selectedDate]);

  return (
    <div className="bg-white rounded-2xl border border-serene-neutral-100 overflow-hidden shadow-sm">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-serene-neutral-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-serene-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="h-5 w-5 text-serene-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-serene-neutral-900">Schedule</h3>
            <p className="text-sm text-serene-neutral-500">{upcomingAppointmentsCount} upcoming appointment{upcomingAppointmentsCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-serene-neutral-400" /> : <ChevronDown className="h-5 w-5 text-serene-neutral-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-serene-neutral-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex bg-serene-neutral-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('week')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", viewMode === 'week' ? "bg-white text-serene-blue-700 shadow-sm" : "text-serene-neutral-600")}>Week</button>
              <button onClick={() => setViewMode('month')} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", viewMode === 'month' ? "bg-white text-serene-blue-700 shadow-sm" : "text-serene-neutral-600")}>Month</button>
            </div>
            <p className="text-sm font-medium text-serene-neutral-700">{selectedDate.toLocaleDateString('default', { month: 'short', year: 'numeric' })}</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}>←</Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}>→</Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-center text-[10px] font-bold text-serene-neutral-400 py-1">{d}</div>)}
            {weekDays.map((day, idx) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const hasAppts = getAppointmentsForDay(day).length > 0;
              return (
                <button key={idx} onClick={() => setSelectedDate(day)} className={cn("aspect-square rounded-xl flex flex-col items-center justify-center transition-all", isSelected ? "bg-serene-blue-600 text-white" : isToday ? "bg-serene-blue-50 text-serene-blue-700" : "hover:bg-serene-neutral-50 text-serene-neutral-700")}>
                  <span className="text-sm font-semibold">{day.getDate()}</span>
                  {hasAppts && <div className={cn("h-1 w-1 rounded-full mt-0.5", isSelected ? "bg-white" : "bg-serene-blue-500")} />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-serene-neutral-100">
            {selectedDayAppointments.length > 0 ? (
              <div className="space-y-2">
                {selectedDayAppointments.map((appt, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-serene-neutral-50/80 rounded-xl">
                    <div className="h-10 w-10 bg-serene-blue-100 rounded-lg flex items-center justify-center text-serene-blue-700"><Clock className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-serene-neutral-900 text-sm truncate">{appt.matched_service?.service_details?.name || 'Appointment'}</p>
                      <p className="text-xs text-serene-neutral-500">{new Date(appt.appointment_date || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-serene-neutral-400 text-center py-2">No appointments scheduled</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardSearchOverlay({ query, filteredReports, filteredMatches, onClear }: any) {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between pb-2 border-b border-serene-neutral-200">
        <h3 className="text-lg font-bold text-serene-neutral-900">Search Results</h3>
        <button onClick={onClear} className="text-sm font-medium text-serene-neutral-500 hover:text-serene-red-500">Clear</button>
      </div>
      
      <div className="space-y-3">
        {[...(filteredReports || []), ...(filteredMatches || [])].length > 0 ? (
          <>
            {filteredReports?.map((report: any) => (
              <SereneActivityCard key={report.report_id} report={report} href={`/dashboard/reports/${report.report_id}`} />
            ))}
            {filteredMatches?.map((match: any) => (
               <Link href={`/dashboard/cases/${match.id}`} key={match.id} className="block group">
               <Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 p-4 flex items-center gap-4">
                 <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-serene-blue-50 text-serene-blue-600"><Shield className="h-5 w-5" /></div>
                 <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-serene-neutral-900 truncate">{match.report?.type_of_incident?.replace(/_/g, " ") || "Case"}</h4>
                    <p className="text-sm text-serene-neutral-500 truncate">{match.service_details?.name || "Support case"}</p>
                 </div>
                 <ChevronRight className="h-4 w-4 text-serene-neutral-300" />
               </Card>
             </Link>
            ))}
          </>
        ) : (
          <div className="text-center py-24">
            <Search className="h-8 w-8 text-serene-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-serene-neutral-900 mb-1">No results found</h3>
            <p className="text-serene-neutral-500">We couldn't find anything matching "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardEmptyState({ icon, title, description, action }: any) {
    return (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-serene-neutral-200">
            <div className="h-12 w-12 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3 text-serene-neutral-400">
                {icon}
            </div>
            <p className="text-serene-neutral-500 mb-1 font-semibold">{title}</p>
            <p className="text-sm text-serene-neutral-400 mb-4">{description}</p>
            {action && (
                <Button className="text-serene-blue-600 font-semibold" variant="link" onClick={action.onClick} asChild={!!action.href}>
                    {action.href ? <Link href={action.href}>{action.label}</Link> : <span>{action.label}</span>}
                </Button>
            )}
        </div>
    );
}
