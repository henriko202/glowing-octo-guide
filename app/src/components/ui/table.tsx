import * as React from 'react'

import {cn} from '@/lib/utils'

/**
 * Semantic table primitives (shadcn-style). Real `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`
 * elements — they expose the correct implicit ARIA roles (table / row / columnheader / cell) for
 * free, so consumers don't hand-roll role="grid" on divs. Column widths are set per-usage via
 * `className` on `<TableHead>`/`<TableCell>` (pair with `table-fixed` on `<Table>` for exact widths).
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-border border-b', className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'bg-muted text-muted-foreground px-4 py-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wide',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
