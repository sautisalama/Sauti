"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * Month calendar for react-day-picker v9. (It was written for v8 class names, so headers collapsed
 * and the navigation arrows floated to the left.) Soft surfaces and a quick, ease-out press state,
 * matching the rest of the dashboard.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const cell = "size-9 sm:size-10"
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex w-full flex-col gap-2",
        nav: "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-lg text-serene-neutral-500 transition-[background-color,transform] duration-150 ease-out hover:bg-serene-neutral-100 active:scale-95 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-lg text-serene-neutral-500 transition-[background-color,transform] duration-150 ease-out hover:bg-serene-neutral-100 active:scale-95 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40",
        month_caption: "flex h-9 items-center justify-center px-9",
        caption_label: "text-sm font-semibold text-serene-neutral-900",
        weekdays: "flex",
        weekday: cn(cell, "flex items-center justify-center text-[0.7rem] font-medium uppercase tracking-wide text-serene-neutral-400"),
        weeks: "flex flex-col gap-1",
        week: "flex w-full",
        day: cn(cell, "relative p-0 text-center text-sm"),
        day_button: cn(
          cell,
          "inline-flex items-center justify-center rounded-lg font-normal text-serene-neutral-800 transition-[background-color,color,transform] duration-150 ease-out hover:bg-serene-neutral-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40 disabled:pointer-events-none"
        ),
        selected: "[&>button]:bg-sauti-teal [&>button]:font-semibold [&>button]:text-white [&>button:hover]:bg-sauti-teal",
        today: "[&>button]:bg-serene-neutral-100 [&>button]:font-semibold",
        outside: "[&>button]:text-serene-neutral-300",
        disabled: "[&>button]:text-serene-neutral-300 [&>button]:opacity-60",
        hidden: "invisible",
        range_start: "[&>button]:rounded-r-none",
        range_end: "[&>button]:rounded-l-none",
        range_middle: "[&>button]:rounded-none [&>button]:bg-sauti-teal/10 [&>button]:text-serene-neutral-900",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
