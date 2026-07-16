import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-tight transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Iris fill with a faint top-inset highlight + crisp accent shadow.
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_8px_20px_-10px_var(--brand-glow)] hover:bg-[var(--brand-iris-deep)] hover:-translate-y-px hover:shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_12px_26px_-10px_var(--brand-glow)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-95 hover:-translate-y-px",
        outline:
          "border border-card-border bg-card text-foreground shadow-xs hover:bg-secondary hover:border-[color:var(--brand-line)] hover:-translate-y-px",
        secondary:
          "border border-secondary-border bg-secondary text-secondary-foreground hover:bg-muted hover:-translate-y-px",
        ghost:
          "border border-transparent text-foreground hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-11 rounded-lg px-7 text-[0.95rem]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
