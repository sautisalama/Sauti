"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle,
  ArrowRight,
  Calendar,
  MessageCircle,
  Star,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// Welcome Header Component
interface WelcomeHeaderProps {
  name: string;
  userType: "survivor" | "professional" | "ngo";
  timeOfDay?: "morning" | "afternoon" | "evening";
  className?: string;
}

export function WelcomeHeader({ name, userType, timeOfDay = "morning", className }: WelcomeHeaderProps) {
  const getGreeting = () => {
    const time = timeOfDay;
    const greetings = {
      morning: "Good morning",
      afternoon: "Good afternoon", 
      evening: "Good evening"
    };
    return greetings[time];
  };

  const getUserTypeMessage = () => {
    switch (userType) {
      case "survivor":
        return "You're safe here. Take things one step at a time.";
      case "professional":
        return "Ready to make a difference today?";
      case "ngo":
        return "Your support creates lasting change.";
      default:
        return "Welcome to your safe space.";
    }
  };

  return (
    <div className={cn(
      "p-6 md:p-8 bg-sauti-teal-light text-sauti-dark rounded-4xl mb-8 relative overflow-hidden shadow-sm border-0",
      className
    )}>
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-sauti-yellow/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-sauti-red/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl pointer-events-none" />
      
      {/* Dynamic bottom accent bar like the cards */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-sauti-yellow via-sauti-teal to-sauti-red opacity-60" />
      
      <div className="relative z-10">
        <h1 className="text-3xl lg:text-4xl font-black mb-3 tracking-tight">
          {getGreeting()}, <span className="text-sauti-teal">{name}</span>
        </h1>
        <p className="text-sauti-dark/80 text-sm lg:text-lg max-w-xl font-bold leading-relaxed">
          {getUserTypeMessage()}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sauti-dark/60">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/40 rounded-full backdrop-blur-sm shadow-sm">
            <Clock className="h-4 w-4 text-sauti-teal" />
            <span className="text-xs font-black uppercase tracking-wider">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/40 rounded-full backdrop-blur-sm shadow-sm">
            <MapPin className="h-4 w-4 text-sauti-teal" />
            <span className="text-xs font-black uppercase tracking-wider">Nairobi, Kenya</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Action Card Component
interface QuickActionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  badge?: number | string;
  variant?: "default" | "primary" | "secondary";
  className?: string;
}

export function QuickActionCard({ 
  icon, 
  title, 
  description, 
  href, 
  onClick, 
  badge, 
  variant = "default",
  className 
}: QuickActionProps) {
  const baseClasses = cn(
    "group relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
    "hover:scale-[1.02] hover:shadow-lg active:scale-95 cursor-pointer border-0 shadow-sm",
    {
      "bg-sauti-teal-light text-sauti-dark": variant === "default",
      "bg-sauti-yellow-light text-sauti-dark": variant === "primary",
      "bg-sauti-red-light text-sauti-dark": variant === "secondary",
    },
    className
  );

  const accentColor = {
    default: "bg-sauti-teal",
    primary: "bg-sauti-yellow",
    secondary: "bg-sauti-red",
  }[variant];

  const content = (
    <div className={baseClasses}>
      {/* Dynamic Accent Bar like the reference image */}
      <div className={cn("absolute bottom-0 left-0 right-0 h-2 opacity-80", accentColor)} />
      
      {badge && (
        <Badge className="absolute top-2 right-2 bg-sauti-red text-white border-0 font-bold">
          {badge}
        </Badge>
      )}
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            "p-2.5 rounded-xl transition-colors duration-300 bg-white/50",
          )}>
            {icon}
          </div>
          <ArrowRight className="h-4 w-4 text-sauti-dark/40 transition-transform group-hover:translate-x-1" />
        </div>
        
        <h3 className="font-black text-sm mb-1 text-sauti-dark tracking-tight">
          {title}
        </h3>
        
        {description && (
          <p className="text-xs leading-relaxed text-sauti-dark/70 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

// Stats Card Component  
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon?: ReactNode;
  description?: string;
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  icon, 
  description, 
  variant = "default",
  className 
}: StatsCardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "success":
        return "bg-sauti-teal-light border-0 shadow-sm";
      case "warning":
        return "bg-sauti-yellow-light border-0 shadow-sm";
      case "error":
        return "bg-sauti-red-light border-0 shadow-sm";
      default:
        return "bg-white border-neutral-50 shadow-sm";
    }
  };

  return (
    <Card className={cn(getVariantClasses(), "overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <h3 className="text-xs font-black uppercase tracking-wider text-sauti-dark/60">
            {title}
          </h3>
          {icon && (
            <div className={cn(
              "p-2 rounded-xl transition-all duration-300",
              {
                "bg-sauti-teal text-white": variant === "success",
                "bg-sauti-yellow text-sauti-dark": variant === "warning", 
                "bg-sauti-red text-white": variant === "error",
                "bg-neutral-100 text-neutral-600": variant === "default",
              }
            )}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-2 relative z-10">
          <span className="text-3xl font-black text-sauti-dark">
            {value}
          </span>
          
          {change && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              change.type === "increase" ? "text-success-600" : "text-error-600"
            )}>
              {change.type === "increase" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{change.value}%</span>
            </div>
          )}
        </div>

        {description && (
          <p className="text-xs text-sauti-dark/60 font-medium relative z-10">
            {description}
          </p>
        )}
        
        {/* Decorative background circle based on variant */}
        <div className={cn(
          "absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-xl",
          {
            "bg-sauti-teal": variant === "success",
            "bg-sauti-yellow": variant === "warning",
            "bg-sauti-red": variant === "error",
            "bg-neutral-200": variant === "default",
          }
        )} />
      </CardContent>
    </Card>
  );
}

// Progress Ring Component
interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
}

export function ProgressRing({ 
  progress, 
  size = 120, 
  strokeWidth = 8, 
  className, 
  children 
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-neutral-200 dark:text-neutral-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="text-sauti-teal transition-all duration-700"
          strokeLinecap="round"
        />
      </svg>
      
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

// Activity Item Component
interface ActivityItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  timestamp: string;
  status?: "success" | "pending" | "warning" | "error";
  onClick?: () => void;
  className?: string;
}

export function ActivityItem({ 
  icon, 
  title, 
  description, 
  timestamp, 
  status,
  onClick,
  className 
}: ActivityItemProps) {
  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "text-sauti-teal";
      case "warning": 
        return "text-sauti-yellow";
      case "error":
        return "text-sauti-red";
      case "pending":
        return "text-neutral-500";
      default:
        return "text-sauti-teal";
    }
  };

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors",
        onClick && "hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className={cn("flex-shrink-0 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800", getStatusColor())}>
        {icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">
          {title}
        </h4>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
          {description}
        </p>
        <span className="text-xs text-neutral-500">
          {timestamp}
        </span>
      </div>
      
      {onClick && (
        <ChevronRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
      )}
    </div>
  );
}

// Section Header Component
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h2 className="text-xl font-black text-sauti-dark tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm font-bold text-neutral-400 mt-1">
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={action.onClick}
          asChild={!!action.href}
        >
          {action.href ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            action.label
          )}
        </Button>
      )}
    </div>
  );
}
