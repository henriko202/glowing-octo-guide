import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { ChevronsUpDown, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { api } from '../../convex'
import { performSignOut } from '@/lib/session'
import { Avatar } from '../ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu'

export default function UserMenu({ name = 'Account' }: { name?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useMutation(api.users.logout)

  async function handleSignOut() {
    await performSignOut(logout, sessionStorage.getItem('sessionToken'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.openMenu')}
        className="hover:bg-sidebar-accent/60 focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2"
      >
        <Avatar
          name={name}
          size="sm"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <ChevronsUpDown
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
      >
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <SettingsIcon
            className="size-4"
            aria-hidden="true"
          />
          {t('shell.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut
            className="size-4"
            aria-hidden="true"
          />
          {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
