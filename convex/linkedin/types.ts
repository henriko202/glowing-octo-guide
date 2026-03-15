// LinkedIn API response types

export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  headline?: string;
  profilePicture?: {
    "displayImage~"?: {
      elements?: Array<{
        identifiers?: Array<{ identifier: string }>;
      }>;
    };
  };
}

export interface LinkedInTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LinkedInUGCPostMedia {
  originalUrl?: string;
}

export interface LinkedInUGCPost {
  id: string;
  specificContent?: {
    "com.linkedin.ugc.ShareContent"?: {
      shareCommentary?: { text: string };
      shareMediaCategory?: string;
      media?: LinkedInUGCPostMedia[];
    };
  };
  created?: { time: number };
  socialDetail?: {
    totalSocialActivityCounts?: {
      numLikes?: number;
      numComments?: number;
    };
  };
}

export interface LinkedInUGCPostsResponse {
  elements?: LinkedInUGCPost[];
}

export interface LinkedInConnectionElement {
  connectedMember?: string | null;
}

export interface LinkedInConnectionsResponse {
  elements?: LinkedInConnectionElement[];
}
