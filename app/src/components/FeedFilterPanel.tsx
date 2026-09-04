import {useState} from 'react'
import {useMutation} from 'convex/react'
import {useTranslation} from 'react-i18next'
import {SlidersHorizontal} from 'lucide-react'
import {api} from '../convex'
import {COUNTRY_CODES, countryLabel, INDUSTRIES} from '../../../convex/lib/profileOptions'
import {ChipMultiSelect} from '@/components/ChipMultiSelect'
import {Button} from '@/components/ui/button'
import {friendlyError} from '@/lib/errors'

/**
 * Pro/Contact feed filter. The selected industries/countries are the saved server values (from
 * getMe) — this panel is stateless about them: every add/remove/clear calls users.setFeedFilter,
 * which patches the viewer doc and re-runs getFeed + getMe reactively, so the chips and the feed
 * both update from the new server value. AND semantics between the two lists live in convex/feed.ts.
 */
export function FeedFilterPanel({
  sessionToken,
  industries,
  countries
}: {
  sessionToken: string
  industries: string[]
  countries: string[]
}) {
  const { t, i18n } = useTranslation()
  const setFeedFilter = useMutation(api.users.setFeedFilter)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lang = i18n.language?.split('-')[0] ?? 'en'
  const industryOptions = INDUSTRIES.map(i => ({ value: i.code, label: i.label }))
  const countryOptions = COUNTRY_CODES.map(code => ({ value: code, label: countryLabel(code, lang) })).sort((a, b) =>
    a.label.localeCompare(b.label)
  )
  const activeCount = industries.length + countries.length

  async function save(nextIndustries: string[], nextCountries: string[]) {
    setError(null)
    try {
      await setFeedFilter({ sessionToken, industries: nextIndustries, countries: nextCountries })
    } catch (err: unknown) {
      setError(friendlyError(err, String(err)))
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {t('feed.filter.toggle')}
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground ml-2 rounded-full px-1.5 py-0.5 text-[11px] leading-none">
              {activeCount}
            </span>
          )}
        </Button>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => save([], [])}
          >
            {t('feed.filter.clear')}
          </Button>
        )}
      </div>

      {open && (
        <div className="border-border bg-card mt-2 rounded-md border p-3">
          <p className="text-muted-foreground mb-3 text-xs">{t('feed.filter.note')}</p>

          <label className="text-foreground mb-1 block text-xs font-medium">{t('feed.filter.industries')}</label>
          <ChipMultiSelect
            options={industryOptions}
            selected={industries}
            onAdd={value => save([...industries, value], countries)}
            onRemove={value =>
              save(
                industries.filter(v => v !== value),
                countries
              )
            }
            ariaLabel={t('feed.filter.industries')}
            addPlaceholder={t('feed.filter.addIndustry')}
            searchPlaceholder={t('feed.filter.selectPlaceholder')}
            emptyText={t('feed.filter.noResults')}
            removeLabel={label => t('feed.filter.remove', { label })}
          />

          <label className="text-foreground mt-2 mb-1 block text-xs font-medium">{t('feed.filter.countries')}</label>
          <ChipMultiSelect
            options={countryOptions}
            selected={countries}
            onAdd={value => save(industries, [...countries, value])}
            onRemove={value =>
              save(
                industries,
                countries.filter(v => v !== value)
              )
            }
            ariaLabel={t('feed.filter.countries')}
            addPlaceholder={t('feed.filter.addCountry')}
            searchPlaceholder={t('feed.filter.selectPlaceholder')}
            emptyText={t('feed.filter.noResults')}
            removeLabel={label => t('feed.filter.remove', { label })}
          />

          {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
        </div>
      )}
    </div>
  )
}
