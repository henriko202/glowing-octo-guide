import * as React from 'react'
import { Tabs as Primitive } from 'radix-ui'
import { cn } from '@/lib/utils'

const Tabs = Primitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn('border-border flex border-b', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        'text-muted-foreground border-b-2 border-transparent px-3 py-2 text-sm font-medium',
        'data-[state=active]:border-primary data-[state=active]:text-foreground',
        'hover:text-foreground',
        'focus-visible:ring-ring outline-none focus-visible:ring-2',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      className={cn('pt-4 focus-visible:outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
