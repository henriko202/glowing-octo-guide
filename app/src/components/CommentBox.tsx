import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../convex";

export default function CommentBox({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const comment = useAction(api.interactions.commentOnPost);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await comment({ postId: postId as any, commentText: text.trim() });
      setText("");
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "12px 0", fontFamily: "system-ui, sans-serif" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment... (AI suggestions coming soon)"
        style={{
          width: "100%",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          resize: "vertical",
          boxSizing: "border-box",
          minHeight: 72,
          fontFamily: "inherit",
        }}
        disabled={submitting}
        rows={3}
      />
      {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "4px 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          style={{
            padding: "6px 16px",
            background: submitting || !text.trim() ? "#93c5fd" : "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting || !text.trim() ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Posting..." : "Post to LinkedIn"}
        </button>
      </div>
    </form>
  );
}
