import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

/**
 * Where you are, in one quiet line. It scrolls with the page and takes no more height than the text itself:
 * no sticky bar, no rule, no animation. The last item is the current page and is not a link. On a phone only
 * the parent and the current page are shown.
 */
export function SereneBreadcrumb({ items, className }: SereneBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3 flex min-w-0 items-center gap-1 text-[12px] leading-5 text-serene-neutral-400", className)}>
      <Link href="/dashboard" className="shrink-0 transition-colors hover:text-sauti-teal">Home</Link>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const hideOnPhone = items.length > 2 && index < items.length - 2;
        return (
          <span key={index} className={cn("flex min-w-0 items-center gap-1", hideOnPhone && "max-sm:hidden")}>
            <ChevronRight className="h-3 w-3 shrink-0 text-serene-neutral-300" aria-hidden />
            {item.href && !last && !item.active ? (
              <Link href={item.href} className="truncate transition-colors hover:text-sauti-teal">{item.label}</Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-serene-neutral-600">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
