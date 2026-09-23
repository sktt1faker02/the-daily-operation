/**
 * Popover + Calendar date pickers (shadcn/react-day-picker) used in place of the
 * native `<input type="date">`. Both speak ISO `yyyy-MM-dd` strings so they drop
 * into the existing form state unchanged; an empty string means "no date".
 */
import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const DISPLAY = "MMM d, yyyy"
const ISO = "yyyy-MM-dd"

/** Dropdown month/year range for the calendars (broad enough for hire dates and cutoffs). */
const START_MONTH = new Date(new Date().getFullYear() - 40, 0, 1)
const END_MONTH = new Date(new Date().getFullYear() + 5, 11, 31)

function toDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? undefined : d
}

const triggerClass = (empty: boolean, className?: string) =>
  cn("w-full justify-start text-left font-normal", empty && "text-muted-foreground", className)

/** Single-date picker. `value`/`onChange` use ISO `yyyy-MM-dd` (or "" for none). */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  invalid,
  className,
}: {
  id?: string
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={triggerClass(!selected, className)}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {selected ? format(selected, DISPLAY) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={END_MONTH}
          autoFocus
          onSelect={(d) => {
            onChange(d ? format(d, ISO) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** Date-range picker. `start`/`end` use ISO `yyyy-MM-dd` (or "" for none). */
export function DateRangePicker({
  id,
  start,
  end,
  onChange,
  placeholder = "Pick a date range",
  disabled,
  invalid,
  className,
}: {
  id?: string
  start: string
  end: string
  onChange: (range: { start: string; end: string }) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const from = toDate(start)
  const to = toDate(end)
  const range: DateRange | undefined = from || to ? { from, to } : undefined

  const label = from
    ? to
      ? `${format(from, DISPLAY)} – ${format(to, DISPLAY)}`
      : format(from, DISPLAY)
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={triggerClass(!from, className)}
        >
          <CalendarIcon className="size-4" aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={from}
          numberOfMonths={2}
          captionLayout="dropdown"
          startMonth={START_MONTH}
          endMonth={END_MONTH}
          autoFocus
          onSelect={(r) => {
            // Stay open until the user clicks outside (Popover default) so they can
            // adjust either end of the range before committing.
            onChange({
              start: r?.from ? format(r.from, ISO) : "",
              end: r?.to ? format(r.to, ISO) : "",
            })
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
