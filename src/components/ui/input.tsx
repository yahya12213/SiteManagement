// @ts-nocheck
import * as React from "react"
import { cn } from "@/lib/utils/cellUtils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-input border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all duration-fast ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:border-primary-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary hover:border-gray-300",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
