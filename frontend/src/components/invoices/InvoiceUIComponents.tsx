// Shared UI components for Invoice pages
import * as React from "react"
import { motion } from "motion/react"
import { twMerge } from "tailwind-merge"
import { CheckCircle2, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@/types/api"
import { invoiceStatusStyles } from "./invoice-utils"

// Animation variants
export const cardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

// Motion Card wrapper
export const MotionCard = motion.create(Card)

// Skeleton loader
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={twMerge("animate-pulse rounded-md bg-muted/60", className)}
    {...props}
  />
)

// Status Badge component
interface StatusBadgeProps {
  status: InvoiceStatus
  size?: "sm" | "lg"
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "sm" }) => {
  const style = invoiceStatusStyles[status] || invoiceStatusStyles.DRAFT
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        style.className,
        size === "lg" && "px-3 py-1 text-sm"
      )}
    >
      <span
        className={cn("rounded-full", style.dot, size === "lg" ? "size-2" : "size-1.5")}
        aria-hidden="true"
      />
      {style.label}
    </Badge>
  )
}

// Tax Status component
interface TaxStatusProps {
  label: string
  paid: boolean
}

export const TaxStatus: React.FC<TaxStatusProps> = ({ label, paid }) => (
  <div className="flex items-center gap-2">
    {paid ? (
      <CheckCircle2 className="size-4 text-emerald-500" />
    ) : (
      <XCircle className="size-4 text-red-500" />
    )}
    <span className={cn("text-sm", paid ? "text-emerald-700" : "text-red-700")}>
      {label} {paid ? "Lunas" : "Belum"}
    </span>
  </div>
)

// Info Row component for displaying label-value pairs
interface InfoRowProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  monospace?: boolean
  className?: string
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  icon: Icon,
  monospace,
  className,
}) => (
  <div className={cn("flex items-start gap-3", className)}>
    {Icon && (
      <span className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100 flex-shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </span>
    )}
    <div className="flex-1 min-w-0 space-y-0.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-medium text-slate-900",
          monospace ? "font-mono tracking-wide break-all" : "break-words"
        )}
      >
        {value}
      </p>
    </div>
  </div>
)

// Info Card Item - for simple inline label-value display
interface InfoCardItemProps {
  label: string
  value: React.ReactNode
  className?: string
}

export const InfoCardItem: React.FC<InfoCardItemProps> = ({ label, value, className }) => (
  <div className={cn("flex justify-between text-sm", className)}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
)

// Section Header component
interface SectionHeaderProps {
  icon: LucideIcon
  tag: string
  title: string
  description?: string
  rightIcon?: LucideIcon
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  tag,
  title,
  description,
  rightIcon: RightIcon,
}) => (
  <div className="flex items-start justify-between">
    <div>
      <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
        <Icon className="h-3.5 w-3.5" />
        {tag}
      </span>
      <h3 className="mt-3 text-xl font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500">{description}</p>
      )}
    </div>
    {RightIcon && (
      <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
        <RightIcon className="h-5 w-5 text-rose-500" />
      </span>
    )}
  </div>
)

// Highlight Card - for key metrics display
interface HighlightCardProps {
  label: string
  value: string
  helper?: string
  icon: LucideIcon
  monospace?: boolean
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  label,
  value,
  helper,
  icon: Icon,
  monospace,
}) => (
  <div className="flex w-full items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
    <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <div className="flex w-full flex-col">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-slate-400">
        {label}
      </span>
      <span
        title={value === "—" ? undefined : value}
        className={cn(
          "text-xs font-semibold text-slate-800 leading-snug",
          monospace ? "font-mono text-sm tracking-wide break-all" : "break-words"
        )}
      >
        {value}
      </span>
      {helper && (
        <span className="text-[0.65rem] text-slate-400 break-words" title={helper}>
          {helper}
        </span>
      )}
    </div>
  </div>
)

// Empty State component
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Icon className="size-10 text-muted-foreground/50 mb-2" />
    <p className="text-muted-foreground">{title}</p>
    {description && (
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    )}
  </div>
)
