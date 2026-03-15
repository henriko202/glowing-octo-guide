import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    _id: "u1",
    name: "Test User",
    tier: "pro",
    industry: "tech",
    country: "US",
  })),
  useAction: vi.fn(),
}));

import SettingsPage from "./SettingsPage";

describe("SettingsPage", () => {
  it("shows Pro visibility section for Pro users", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/who can see your posts/i)).toBeInTheDocument();
  });
});
