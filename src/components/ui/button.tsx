// @ts-nocheck
import * as React from "react"
import { cn } from "@/lib/utils/cellUtils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 rounded-input text-sm font-semibold transition-all duration-normal ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] shadow-elevation-1 hover:shadow-elevation-2"

    const variants = {
      default: "bg-gradient-to-b from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 focus-visible:ring-primary-500",
      destructive: "bg-gradient-to-b from-danger-500 to-danger-600 text-white hover:from-danger-600 hover:to-danger-600 focus-visible:ring-danger-500",
      success: "bg-gradient-to-b from-success-500 to-success-600 text-white hover:from-success-600 hover:to-success-700 focus-visible:ring-success-500",
      outline: "border-2 border-gray-200 bg-white text-gray-700 hover:bg-surface-secondary hover:border-gray-300 focus-visible:ring-primary-400 shadow-none hover:shadow-elevation-1",
      secondary: "bg-surface-tertiary text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400 shadow-none hover:shadow-elevation-1",
      ghost: "hover:bg-surface-secondary text-gray-700 hover:text-gray-900 focus-visible:ring-gray-400 shadow-none",
      link: "underline-offset-4 hover:underline text-primary-600 hover:text-primary-700 shadow-none",
    }

    const sizes = {
      default: "h-11 py-2.5 px-5",
      sm: "h-9 px-4 text-xs rounded-badge",
      lg: "h-12 px-8 text-base rounded-card",
      icon: "h-10 w-10 rounded-badge",
    }

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }
