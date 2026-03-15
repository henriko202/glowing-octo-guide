// convex/linkedin/posts.test.ts
import { describe, it, expect } from "vitest";
import { parseLinkedInPost } from "./posts";

describe("parseLinkedInPost", () => {
  it("extracts required fields from a LinkedIn UGC post", () => {
    const raw = {
      id: "urn:li:ugcPost:123",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: "Hello world" },
          shareMediaCategory: "NONE",
          media: [],
        },
      },
      created: { time: 1700000000000 },
      socialDetail: {
        totalSocialActivityCounts: { numLikes: 5, numComments: 2 },
      },
    };
    const parsed = parseLinkedInPost(raw);
    expect(parsed.linkedinPostUrn).toBe("urn:li:ugcPost:123");
    expect(parsed.content).toBe("Hello world");
    expect(parsed.publishedAt).toBe(1700000000000);
    expect(parsed.likeCount).toBe(5);
    expect(parsed.commentCount).toBe(2);
    expect(parsed.mediaUrls).toEqual([]);
  });

  it("handles missing socialDetail gracefully (defaults to 0)", () => {
    const raw = {
      id: "urn:li:ugcPost:456",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: "No counts" },
          media: [],
        },
      },
      created: { time: 1700000000000 },
    };
    const parsed = parseLinkedInPost(raw);
    expect(parsed.likeCount).toBe(0);
    expect(parsed.commentCount).toBe(0);
  });

  it("extracts media URLs from media array", () => {
    const raw = {
      id: "urn:li:ugcPost:789",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: "With media" },
          media: [
            { originalUrl: "https://example.com/img1.jpg" },
            { originalUrl: "https://example.com/img2.jpg" },
          ],
        },
      },
      created: { time: 1700000000000 },
    };
    const parsed = parseLinkedInPost(raw);
    expect(parsed.mediaUrls).toEqual([
      "https://example.com/img1.jpg",
      "https://example.com/img2.jpg",
    ]);
  });
});
