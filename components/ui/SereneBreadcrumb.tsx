import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface SereneBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function SereneBreadcrumb({ items, className }: SereneBreadcrumbProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn(
        "flex items-center space-x-2 text-sm text-serene-neutral-500",
        "sticky top-0 z-40 bg-white/70 backdrop-blur-xl",
        "py-4 -mx-4 px-4 md:-mx-6 md:px-6",
        "border-b border-serene-neutral-100/80 mb-6",
        "transition-all duration-500 ease-in-out antialiased", 
        className
      )}
    >
      <Link 
        href="/dashboard" 
        className="flex items-center text-serene-neutral-400 hover:text-sauti-teal transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${(index + 1) * 100}ms` }}>
          <ChevronRight className="h-4 w-4 text-serene-neutral-200" />
          {item.href && !item.active ? (
            <Link 
              href={item.href}
              className="hover:text-sauti-teal transition-colors font-medium hover:underline decoration-sauti-teal/30 underline-offset-4"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(
              "font-semibold text-sauti-dark/90 tracking-tight", 
              item.active && "cursor-default"
            )}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
