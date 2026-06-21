import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type RowAction = {
  label: string
  onClick: () => void
  danger?: boolean
  // When set, the item is shown muted and inert; `title` explains why (tooltip).
  disabled?: boolean
  title?: string
}

type Props = {
  label: string
  items: RowAction[]
}

export default function RowActionsMenu({ label, items }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
        >
          <span className="text-base leading-none tracking-widest">···</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(item => (
          <DropdownMenuItem
            key={item.label}
            onSelect={item.onClick}
            disabled={item.disabled}
            title={item.title}
            className={item.danger ? 'text-destructive focus:text-destructive' : undefined}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
