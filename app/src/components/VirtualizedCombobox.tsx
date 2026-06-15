import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  value: string
  label: string
}

interface VirtualizedCommandProps {
  height: string
  options: ComboboxOption[]
  placeholder: string
  emptyText: string
  selectedOption: string
  onSelectOption?: (option: string) => void
}

function VirtualizedCommand({
  height,
  options,
  placeholder,
  emptyText,
  selectedOption,
  onSelectOption
}: VirtualizedCommandProps) {
  const [filteredOptions, setFilteredOptions] = React.useState<ComboboxOption[]>(options)
  const [focusedIndex, setFocusedIndex] = React.useState(0)
  const [isKeyboardNavActive, setIsKeyboardNavActive] = React.useState(false)

  const parentRef = React.useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is intentional; its API is used directly, not memoized.
  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35
  })

  const virtualOptions = virtualizer.getVirtualItems()

  const scrollToIndex = (index: number) => {
    virtualizer.scrollToIndex(index, { align: 'center' })
  }

  const handleSearch = (search: string) => {
    setIsKeyboardNavActive(false)
    setFilteredOptions(options.filter(option => option.label.toLowerCase().includes(search.toLowerCase())))
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        setIsKeyboardNavActive(true)
        setFocusedIndex(prev => {
          const newIndex = prev === -1 ? 0 : Math.min(prev + 1, filteredOptions.length - 1)
          scrollToIndex(newIndex)
          return newIndex
        })
        break
      }
      case 'ArrowUp': {
        event.preventDefault()
        setIsKeyboardNavActive(true)
        setFocusedIndex(prev => {
          const newIndex = prev === -1 ? filteredOptions.length - 1 : Math.max(prev - 1, 0)
          scrollToIndex(newIndex)
          return newIndex
        })
        break
      }
      case 'Enter': {
        event.preventDefault()
        if (filteredOptions[focusedIndex]) {
          onSelectOption?.(filteredOptions[focusedIndex].value)
        }
        break
      }
      default:
        break
    }
  }

  React.useEffect(() => {
    if (selectedOption) {
      const index = filteredOptions.findIndex(option => option.value === selectedOption)
      if (index >= 0) {
        setFocusedIndex(index)
        virtualizer.scrollToIndex(index, { align: 'center' })
      }
    }
  }, [selectedOption, filteredOptions, virtualizer])

  return (
    <Command
      shouldFilter={false}
      onKeyDown={handleKeyDown}
    >
      <CommandInput
        onValueChange={handleSearch}
        placeholder={placeholder}
      />
      <CommandList
        ref={parentRef}
        style={{ height, width: '100%', overflow: 'auto' }}
        onMouseDown={() => setIsKeyboardNavActive(false)}
        onMouseMove={() => setIsKeyboardNavActive(false)}
      >
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualOptions.map(virtualOption => (
              <CommandItem
                key={filteredOptions[virtualOption.index].value}
                disabled={isKeyboardNavActive}
                className={cn(
                  'absolute left-0 top-0 w-full bg-transparent',
                  focusedIndex === virtualOption.index && 'bg-accent text-accent-foreground',
                  isKeyboardNavActive &&
                    focusedIndex !== virtualOption.index &&
                    'aria-selected:text-primary aria-selected:bg-transparent'
                )}
                style={{ height: `${virtualOption.size}px`, transform: `translateY(${virtualOption.start}px)` }}
                value={filteredOptions[virtualOption.index].value}
                onMouseEnter={() => !isKeyboardNavActive && setFocusedIndex(virtualOption.index)}
                onMouseLeave={() => !isKeyboardNavActive && setFocusedIndex(-1)}
                onSelect={onSelectOption}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedOption === filteredOptions[virtualOption.index].value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {filteredOptions[virtualOption.index].label}
              </CommandItem>
            ))}
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

interface VirtualizedComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  /** Label shown on the trigger when nothing is selected. */
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
  height?: string
}

export function VirtualizedCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  ariaLabel,
  disabled,
  className,
  height = '300px'
}: VirtualizedComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const [contentWidth, setContentWidth] = React.useState<string>()

  React.useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setContentWidth(`${triggerRef.current.offsetWidth}px`)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-auto w-full justify-between rounded-md border-slate-300 px-[10px] py-[7px] text-[13px] font-normal',
            !selected && 'text-slate-400',
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: contentWidth }}
      >
        <VirtualizedCommand
          height={height}
          options={options}
          placeholder={searchPlaceholder}
          emptyText={emptyText}
          selectedOption={value}
          onSelectOption={currentValue => {
            // Re-selecting the current value clears it (acts as "Not set").
            onChange(currentValue === value ? '' : currentValue)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
