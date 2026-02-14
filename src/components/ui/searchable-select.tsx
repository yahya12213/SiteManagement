import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils/cellUtils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface SearchableSelectOption {
  value: string
  label: string
  searchValue?: string  // Valeur additionnelle pour la recherche (ex: code ville)
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  emptyMessage?: string
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Sélectionnez...",
  disabled = false,
  className,
  emptyMessage = "Aucun résultat trouvé.",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  // Filtrer par label ET searchValue (code ville)
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    const query = searchQuery.toLowerCase().trim()
    return options.filter((option) => {
      const matchLabel = option.label.toLowerCase().includes(query)
      const matchSearch = option.searchValue?.toLowerCase().includes(query)
      return matchLabel || matchSearch
    })
  }, [options, searchQuery])

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue)
    setOpen(false)
    setSearchQuery("")
  }

  // Reset search when closing
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("")
    } else {
      // Focus l'input quand le popover s'ouvre
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Handle Enter key to select first option
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'Enter' && filteredOptions.length === 1) {
      e.preventDefault()
      handleSelect(filteredOptions[0].value)
      return
    }
  }

  const listboxId = React.useId()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={listboxId}
        className="w-[--radix-popover-trigger-width] p-0 bg-white border shadow-lg"
        align="start"
      >
        {/* Champ de recherche intégré */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="max-h-[250px] overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center px-3 py-2 text-sm hover:bg-blue-50",
                  value === option.value && "bg-blue-50 text-blue-700"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 text-blue-600",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
