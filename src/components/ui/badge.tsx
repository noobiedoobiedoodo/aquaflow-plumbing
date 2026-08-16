import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-secondary-bg text-white hover:bg-secondary-bg/80",
        blue:
          "border-transparent bg-primary-blue/10 text-primary-blue hover:bg-primary-blue/20",
        cyan:
          "border-transparent bg-water-cyan/10 text-water-cyan hover:bg-water-cyan/20",
        copper:
          "border-transparent bg-copper-accent/10 text-copper-light hover:bg-copper-accent/20",
        success:
          "border-transparent bg-success/10 text-success hover:bg-success/20",
        warning:
          "border-transparent bg-warning/10 text-warning hover:bg-warning/20",
        danger:
          "border-transparent bg-danger/10 text-danger hover:bg-danger/20",
        outline: "text-white border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
