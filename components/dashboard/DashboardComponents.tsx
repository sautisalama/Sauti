"use client";

import { ReactNode } from "react";
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
      "p-6 bg-gradient-to-r from-sauti-blue to-primary-600 text-white rounded-2xl mb-6",
      className
    )}>
      <h1 className="text-2xl lg:text-3xl font-bold mb-2">
        {getGreeting()}, {name}
      </h1>
      <p className="text-blue-100 text-sm lg:text-base opacity-90">
        {getUserTypeMessage()}
      </p>
      <div className="mt-4 flex items-center gap-4 text-blue-100">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">Nairobi, Kenya</span>
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
    "group relative overflow-hidden rounded-xl p-4 transition-all duration-200",
    "hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer",
    {
      "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-sauti-orange": variant === "default",
      "bg-gradient-to-br from-sauti-orange to-accent-600 text-white": variant === "primary",
      "bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-700": variant === "secondary",
    },
    className
  );

  const content = (
    <div className={baseClasses}>
      {badge && (
        <Badge className="absolute top-2 right-2 bg-error-500 text-white border-0">
          {badge}
        </Badge>
      )}
      
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "p-2 rounded-lg",
          variant === "primary" ? "bg-white/20" : "bg-sauti-orange/10"
        )}>
          {icon}
        </div>
        <ArrowRight className={cn(
          "h-4 w-4 transition-transform group-hover:translate-x-1",
          variant === "primary" ? "text-white/70" : "text-neutral-400"
        )} />
      </div>
      
      <h3 className={cn(
        "font-semibold text-sm mb-1",
        variant === "primary" ? "text-white" : "text-neutral-900 dark:text-neutral-100"
      )}>
        {title}
      </h3>
      
      {description && (
        <p className={cn(
          "text-xs leading-relaxed",
          variant === "primary" ? "text-white/80" : "text-neutral-600 dark:text-neutral-400"
        )}>
          {description}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
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
        return "border-success-200 bg-success-50 dark:bg-success-950 dark:border-success-800";
      case "warning":
        return "border-warning-200 bg-warning-50 dark:bg-warning-950 dark:border-warning-800";
      case "error":
        return "border-error-200 bg-error-50 dark:bg-error-950 dark:border-error-800";
      default:
        return "border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700";
    }
  };

  return (
    <Card className={cn(getVariantClasses(), "overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            {title}
          </h3>
          {icon && (
            <div className={cn(
              "p-1 rounded-lg",
              {
                "bg-success-100 text-success-600": variant === "success",
                "bg-warning-100 text-warning-600": variant === "warning", 
                "bg-error-100 text-error-600": variant === "error",
                "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400": variant === "default",
              }
            )}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
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
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        )}
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
          className="text-sauti-orange transition-all duration-500"
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
        return "text-success-600";
      case "warning": 
        return "text-warning-600";
      case "error":
        return "text-error-600";
      case "pending":
        return "text-neutral-500";
      default:
        return "text-sauti-orange";
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
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
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
