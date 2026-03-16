// app/src/components/PostComposer.tsx
import { useState } from "react";

interface PostComposerProps {
  onSubmit: (url: string) => Promise<void>;
}

export default function PostComposer({ onSubmit }: PostComposerProps) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(url.trim());
      setUrl("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#1e293b",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        border: "1px solid #334155",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 8,
          letterSpacing: "0.05em",
        }}
      >
        Share a post
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/posts/your-name_…"
        disabled={submitting}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: 13,
          marginBottom: 8,
          outline: "none",
        }}
      />
      {error && (
        <p style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
          {error}
        </p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#64748b" }}>
          Paste your LinkedIn post URL
        </span>
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          style={{
            background: url.trim() && !submitting ? "#3b82f6" : "#1e3a5f",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            cursor: url.trim() && !submitting ? "pointer" : "not-allowed",
            opacity: !url.trim() || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Submitting\u2026" : "Submit \u2192"}
        </button>
      </div>
    </form>
  );
}
