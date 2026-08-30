import { X } from 'lucide-react'
import { type ComboboxOption, VirtualizedCombobox } from '@/components/VirtualizedCombobox'
import { Badge } from '@/components/ui/badge'

/**
 * One "chip picker" field: removable chips for the currently-selected values, plus a searchable
 * combobox (already-selected options excluded) to add more. Shared by the Settings post-visibility
 * fields and the Feed filter — same interaction, different option list + labels. All user-facing
 * strings are passed in so each caller keeps its own i18n keys.
 */
export function ChipMultiSelect({
  options,
  selected,
  onAdd,
  onRemove,
  ariaLabel,
  addPlaceholder,
  searchPlaceholder,
  emptyText,
  removeLabel
}: {
  options: ComboboxOption[]
  selected: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  ariaLabel: string
  addPlaceholder: string
  searchPlaceholder: string
  emptyText: string
  /** Builds the per-chip remove-button aria-label, e.g. label => `Remove ${label}`. */
  removeLabel: (label: string) => string
}) {
  const labelFor = (value: string) => options.find(o => o.value === value)?.label ?? value
  const selectedSet = new Set(selected)
  const available = options.filter(o => !selectedSet.has(o.value))

  return (
    <div className="mb-3">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map(value => (
            <Badge
              key={value}
              variant="outline"
              className="gap-1 py-1 pr-1 pl-2 text-xs font-normal"
            >
              {labelFor(value)}
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={removeLabel(labelFor(value))}
                className="hover:bg-muted focus-visible:ring-ring -mr-0.5 rounded-full p-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <VirtualizedCombobox
        options={available}
        value=""
        onChange={onAdd}
        ariaLabel={ariaLabel}
        placeholder={addPlaceholder}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
      />
    </div>
  )
}
