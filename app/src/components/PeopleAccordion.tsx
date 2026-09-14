import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, MessageSquare, ThumbsUp } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { timeAgo } from '@/lib/relativeDay'
import { type Reaction, REACTIONS } from '../../../convex/lib/reactions'

export interface AccordionActor {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  reaction?: Reaction
  reactions: number
  comments: number
  total: number
  lastAt: number
}

const STACK_MAX = 4

/** The emoji of the newest reaction the counterparty sent, read out by its reaction label. */
export function ReactionGlyph({ reaction }: { reaction: Reaction }) {
  const { t } = useTranslation()
  const meta = REACTIONS.find(r => r.value === reaction)
  if (!meta) return null
  return (
    <span
      role="img"
      aria-label={t(meta.labelKey)}
      className="shrink-0 text-sm"
    >
      {meta.emoji}
    </span>
  )
}

export interface AccordionPost {
  postId: string
  excerpt: string
  linkedinPostUrn: string
  sourceUrl?: string
  total: number
  lastAt: number
  removed: boolean
  actors: AccordionActor[]
}

export default function PeopleAccordion({ posts }: { posts: AccordionPost[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {posts.map(post => {
        const expanded = open[post.postId] === true
        const reactions = post.actors.reduce((sum, actor) => sum + actor.reactions, 0)
        const comments = post.actors.reduce((sum, actor) => sum + actor.comments, 0)
        const stack = post.actors.slice(0, STACK_MAX)
        const extra = post.actors.length - stack.length
        return (
          <li
            key={post.postId}
            className="border-border bg-card rounded-xl border shadow-xs"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`post-actors-${post.postId}`}
              onClick={() => setOpen(prev => ({ ...prev, [post.postId]: !expanded }))}
              className="flex w-full flex-col gap-2 p-3 text-left"
            >
              <span className="text-foreground line-clamp-2 text-sm">{post.excerpt}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex items-center">
                  {stack.map((actor, index) => (
                    <Avatar
                      key={actor.userId}
                      name={actor.name}
                      src={actor.profilePictureUrl}
                      size="sm"
                      className={index === 0 ? 'ring-card ring-2' : 'ring-card -ml-2 ring-2'}
                    />
                  ))}
                </span>
                {extra > 0 && (
                  <span className="bg-muted text-muted-foreground inline-flex h-8 items-center justify-center rounded-full px-2 text-xs">
                    {t('people.morePeople', { count: extra })}
                  </span>
                )}
                {post.removed && <Badge variant="outline">{t('people.postRemoved')}</Badge>}
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <ThumbsUp
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  {t('people.tallyReactions', { count: reactions })}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <MessageSquare
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  {t('people.tallyComments', { count: comments })}
                </span>
                <span className="text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 text-xs">
                  {t('people.accordionToggle')}
                  {expanded ? (
                    <ChevronUp
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </span>
            </button>
            {expanded && (
              <ul
                id={`post-actors-${post.postId}`}
                className="border-border m-0 flex list-none flex-col gap-1 border-t p-3"
              >
                {post.actors.map(actor => (
                  <li
                    key={actor.userId}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Avatar
                      name={actor.name}
                      src={actor.profilePictureUrl}
                      size="sm"
                    />
                    {actor.reaction && <ReactionGlyph reaction={actor.reaction} />}
                    {actor.comments > 0 && (
                      <MessageSquare
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-foreground flex-1 truncate">{actor.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(actor.lastAt, t)}</span>
                  </li>
                ))}
                {!post.removed && (
                  <li>
                    <a
                      href={buildPostUrl(post.linkedinPostUrn, post.sourceUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      {t('feed.viewOnLinkedIn')}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
