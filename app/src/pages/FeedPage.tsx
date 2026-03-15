import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../convex";
import PostCard, { type PostWithAuthor } from "../components/PostCard";
import CommentBox from "../components/CommentBox";

export default function FeedPage() {
  const { t } = useTranslation();
  const feed = useQuery(api.feed.getFeed, {});
  const react = useAction(api.interactions.reactToPost);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);

  if (!feed) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontFamily: "system-ui, sans-serif" }}>
        {t("feed.loading")}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>{t("feed.title")}</h1>
      {feed.posts.length === 0 && (
        <p style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
          {t("feed.empty")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {(feed.posts as PostWithAuthor[]).map((post) => (
          <div key={post._id as string}>
            <PostCard
              post={post}
              onComment={(id) => setCommentingOn(id === commentingOn ? null : id)}
              onReact={(id) => react({ postId: id as unknown as string, reactionType: "LIKE" })}
            />
            {commentingOn === (post._id as string) && (
              <CommentBox
                postId={post._id as string}
                onClose={() => setCommentingOn(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
