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
        "flex items-center space-x-2 text-sm text-serene-neutral-500 sticky top-0 z-40 bg-serene-neutral-50/90 backdrop-blur-md py-3 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-serene-neutral-200/50 mb-4 transition-all duration-300", 
        className
      )}
    >
      <Link 
        href="/dashboard" 
        className="flex items-center hover:text-sauti-dark transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4 text-serene-neutral-300" />
          {item.href && !item.active ? (
            <Link 
              href={item.href}
              className="hover:text-sauti-dark transition-colors font-medium hover:underline decoration-serene-neutral-300 underline-offset-4"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn("font-bold text-sauti-dark", item.active && "cursor-default")}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
