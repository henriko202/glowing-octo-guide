import { useTranslation } from "react-i18next";

// Type stub until _generated/ exists
type PostId = string & { __tableName: "posts" };

export type PostWithAuthor = {
  _id: PostId;
  content: string;
  publishedAt: number;
  likeCount: number;
  commentCount: number;
  mediaUrls: string[];
  isFeatured: boolean;
  author: {
    name: string;
    headline?: string;
    profilePictureUrl?: string;
  } | null;
};

export default function PostCard({
  post,
  onComment,
  onReact,
}: {
  post: PostWithAuthor;
  onComment: (postId: PostId) => void;
  onReact: (postId: PostId) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        padding: 20,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {post.isFeatured && (
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 700,
            color: "#d97706",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          {t("feed.featured")}
        </span>
      )}

      {post.author && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {post.author.profilePictureUrl ? (
            <img
              src={post.author.profilePictureUrl}
              alt=""
              style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#dbeafe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "#1d4ed8",
                fontSize: 16,
              }}
            >
              {post.author.name[0]}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 600, color: "#0f172a", margin: 0, fontSize: 14 }}>
              {post.author.name}
            </p>
            {post.author.headline && (
              <p style={{ color: "#64748b", margin: 0, fontSize: 12 }}>{post.author.headline}</p>
            )}
          </div>
        </div>
      )}

      <p style={{ color: "#1e293b", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
        {post.content}
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        <button
          onClick={() => onReact(post._id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          👍 {post.likeCount} {t("feed.like")}
        </button>
        <button
          onClick={() => onComment(post._id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748b",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          💬 {post.commentCount} {t("feed.comment")}
        </button>
      </div>
    </div>
  );
}
