// app/src/pages/MyPostsPage.tsx
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../convex";

// The shape returned by getMyPosts — matches the posts table schema
interface MyPost {
  _id: Id<"posts">;
  linkedinPostUrn: string;
  content: string;
  publishedAt: number;
  likeCount: number;
  commentCount: number;
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function urnToLinkedInUrl(urn: string): string {
  // urn:li:ugcPost:123456789 → /feed/update/urn:li:activity:123456789/
  const id = urn.split(":").pop() ?? "";
  return `https://www.linkedin.com/feed/update/urn:li:activity:${id}/`;
}

export default function MyPostsPage() {
  const userId = (sessionStorage.getItem("convexUserId") ?? undefined) as
    | Id<"users">
    | undefined;

  const me = useQuery(api.users.getMe, { userId });
  const posts = (useQuery(api.posts.getMyPosts, { userId }) ?? []) as MyPost[];

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "32px 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 24,
        }}
      >
        My Posts
      </h1>

      {/* Profile header */}
      {me && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#334155",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontWeight: 700,
            }}
          >
            {me.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
              {me.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>
              {me.tier} plan
            </div>
          </div>
        </div>
      )}

      {/* Section header */}
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 12,
          letterSpacing: "0.05em",
        }}
      >
        Your posts ({posts.length})
      </div>

      {/* Post list */}
      {posts.length === 0 ? (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: 20,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Add posts from the Feed page composer ↑
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {posts.map((post) => (
            <div
              key={post._id}
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: 14,
                border: "1px solid #e2e8f0",
                borderLeft: "3px solid #3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  marginBottom: 8,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {post.content || "(content not available — post added via URL)"}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>
                  👍 {post.likeCount} · 💬 {post.commentCount}
                </span>
                <span>
                  {timeAgo(post.publishedAt)} ·{" "}
                  <a
                    href={urnToLinkedInUrl(post.linkedinPostUrn)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#3b82f6", textDecoration: "none" }}
                  >
                    View on LinkedIn ↗
                  </a>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
