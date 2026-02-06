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
    <nav aria-label="Breadcrumb" className={cn("flex items-center space-x-2 text-sm text-gray-500", className)}>
      <Link 
        href="/dashboard" 
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {item.href && !item.active ? (
            <Link 
              href={item.href}
              className="hover:text-gray-900 transition-colors font-medium"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn("font-semibold text-gray-900", item.active && "cursor-default")}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
