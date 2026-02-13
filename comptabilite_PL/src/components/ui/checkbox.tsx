import * as React from "react"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (checked: boolean) => void
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, indeterminate, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null)
    const combinedRef = ref || innerRef

    React.useEffect(() => {
      const input = typeof combinedRef === 'function' ? null : combinedRef?.current
      if (input) {
        input.indeterminate = !!indeterminate
      }
    }, [indeterminate, combinedRef])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked)
      }
    }

    return (
      <input
        type="checkbox"
        className={`h-4 w-4 shrink-0 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer accent-blue-600 ${className || ''}`}
        ref={combinedRef}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
