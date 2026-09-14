import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, ThumbsUp } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buildPostUrl } from '@/components/LinkedInEmbed'
import { timeAgo } from '@/lib/relativeDay'

export interface AccordionActor {
  userId: string
  name: string
  headline?: string
  profilePictureUrl?: string
  reactions: number
  comments: number
  total: number
  lastAt: number
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
        return (
          <li
            key={post.postId}
            className="rounded-lg border"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`post-actors-${post.postId}`}
              onClick={() => setOpen(prev => ({ ...prev, [post.postId]: !expanded }))}
              className="flex w-full items-center justify-between gap-3 p-3 text-left"
            >
              <span className="text-foreground line-clamp-2 text-sm">{post.excerpt}</span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                {post.removed && <Badge variant="outline">{t('people.postRemoved')}</Badge>}
                <span>{t('people.count', { count: post.total })}</span>
                <span>{t('people.accordionToggle')}</span>
                <span aria-hidden="true">{expanded ? '−' : '+'}</span>
              </span>
            </button>
            {expanded && (
              <ul
                id={`post-actors-${post.postId}`}
                className="m-0 flex list-none flex-col gap-1 border-t p-3"
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
                    {actor.comments > 0 ? (
                      <MessageSquare
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <ThumbsUp
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-foreground flex-1 truncate">{actor.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('people.tally', { reactions: actor.reactions, comments: actor.comments })}
                    </span>
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
