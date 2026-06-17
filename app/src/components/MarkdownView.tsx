import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { markdown: string; className?: string }

// Safe markdown renderer shared by the live MOTD and the admin preview.
// No raw HTML (rehype-raw deliberately omitted); react-markdown's default urlTransform strips
// dangerous URL protocols (javascript:, etc.). Links are forced to open in a new tab safely.
export default function MarkdownView({ markdown, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            />
          )
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
