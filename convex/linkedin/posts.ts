// convex/linkedin/posts.ts

export interface ParsedPost {
  linkedinPostUrn: string;
  content: string;
  publishedAt: number;
  likeCount: number;
  commentCount: number;
  mediaUrls: string[];
}

export function parseLinkedInPost(raw: any): ParsedPost {
  const share = raw.specificContent?.["com.linkedin.ugc.ShareContent"];
  const content = share?.shareCommentary?.text ?? "";
  const mediaUrls: string[] = (share?.media ?? [])
    .map((m: any) => m?.originalUrl)
    .filter(Boolean);

  const counts = raw.socialDetail?.totalSocialActivityCounts ?? {};
  return {
    linkedinPostUrn: raw.id,
    content,
    publishedAt: raw.created?.time ?? Date.now(),
    likeCount: counts.numLikes ?? 0,
    commentCount: counts.numComments ?? 0,
    mediaUrls,
  };
}

export async function fetchUserPosts(
  accessToken: string,
  linkedinPersonId: string
): Promise<ParsedPost[]> {
  const authorUrn = encodeURIComponent(`urn:li:person:${linkedinPersonId}`);
  const res = await fetch(
    `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${authorUrn})&count=20`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );
  if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`);
  const data = await res.json() as { elements?: any[] };
  return (data.elements ?? []).map(parseLinkedInPost);
}
