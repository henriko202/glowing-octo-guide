// app/src/pages/MyPostsPage.test.tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Track call order: first useQuery call = getMe, second = getMyPosts
let queryCallCount = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    queryCallCount += 1;
    if (queryCallCount % 2 === 1) {
      // Odd calls = getMe
      return { name: "Henri Durand", tier: "starter" };
    }
    // Even calls = getMyPosts — empty
    return [];
  }),
  useAction: vi.fn(() => async () => {}),
}));

import { MemoryRouter } from "react-router-dom";
import MyPostsPage from "./MyPostsPage";

describe("MyPostsPage", () => {
  beforeEach(() => {
    queryCallCount = 0;
  });

  it("shows the page heading and user name", () => {
    render(
      <MemoryRouter>
        <MyPostsPage />
      </MemoryRouter>
    );
    expect(screen.getByText("My Posts")).toBeInTheDocument();
    expect(screen.getByText("Henri Durand")).toBeInTheDocument();
  });

  it("shows empty state when no posts", () => {
    render(
      <MemoryRouter>
        <MyPostsPage />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/add posts from the feed/i)
    ).toBeInTheDocument();
  });
});
