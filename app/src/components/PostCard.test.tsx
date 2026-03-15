import { render, screen } from "@testing-library/react";
import PostCard, { type PostWithAuthor } from "./PostCard";

const mockPost: PostWithAuthor = {
  _id: "post123" as any,
  content: "Hello LinkedIn world",
  publishedAt: Date.now(),
  likeCount: 10,
  commentCount: 3,
  mediaUrls: [],
  isFeatured: false,
  author: { name: "Jane Doe", headline: "Engineer" },
};

describe("PostCard", () => {
  it("renders post content and author name", () => {
    render(<PostCard post={mockPost} onComment={() => {}} onReact={() => {}} />);
    expect(screen.getByText("Hello LinkedIn world")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it("shows FEATURED badge when isFeatured is true", () => {
    render(<PostCard post={{ ...mockPost, isFeatured: true }} onComment={() => {}} onReact={() => {}} />);
    expect(screen.getByText(/featured/i)).toBeInTheDocument();
  });
});
