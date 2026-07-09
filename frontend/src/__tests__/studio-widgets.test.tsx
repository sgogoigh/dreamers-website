import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreditMeter } from "@/components/studio/CreditMeter";
import { DreamList } from "@/components/studio/DreamList";
import { InsufficientCredits } from "@/components/studio/InsufficientCredits";
import { VideoPlayer } from "@/components/studio/VideoPlayer";
import { API_URL } from "@/lib/api";
import type { DreamListItem } from "@/types/api";

describe("CreditMeter", () => {
  it("shows balance, videos remaining and held credits", () => {
    render(
      <CreditMeter
        balance={{ balance: 10, held: 5, videos_remaining: 2, credits_per_video: 5 }}
      />,
    );
    expect(screen.getByText("10 credits")).toBeInTheDocument();
    expect(screen.getByText(/2 videos left/)).toBeInTheDocument();
    expect(screen.getByText(/5 held for the current dream/)).toBeInTheDocument();
  });

  it("switches to the low-credit warning below one video", () => {
    render(
      <CreditMeter balance={{ balance: 3, held: 0, videos_remaining: 0, credits_per_video: 5 }} />,
    );
    expect(screen.getByText(/You need 5 credits to dream/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buy credits/ })).toHaveAttribute("href", "/credits");
  });

  it("shows a skeleton while loading", () => {
    render(<CreditMeter balance={undefined} />);
    expect(screen.getByTestId("credit-meter-loading")).toBeInTheDocument();
  });
});

describe("DreamList (session history)", () => {
  const now = new Date();
  const iso = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 24 * 3600 * 1000).toISOString();
  const DREAMS: DreamListItem[] = [
    { id: "d1", title: "Storm keeper", status: "rendering", created_at: iso(0), thumbnail_url: null },
    { id: "d2", title: "Comet garden", status: "completed", created_at: iso(0), thumbnail_url: null },
    { id: "d3", title: "Old failure", status: "failed", created_at: iso(30), thumbnail_url: null },
  ];

  it("groups by date and marks statuses with dots", () => {
    render(<DreamList dreams={DREAMS} activeId="d2" onSelect={() => {}} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getByTestId("dot-active")).toBeInTheDocument();
    expect(screen.getByTestId("dot-completed")).toBeInTheDocument();
    expect(screen.getByTestId("dot-failed")).toBeInTheDocument();
  });

  it("highlights the active dream and fires onSelect", async () => {
    const onSelect = vi.fn();
    render(<DreamList dreams={DREAMS} activeId="d2" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Comet garden/ })).toHaveAttribute("aria-current", "true");
    await userEvent.click(screen.getByRole("button", { name: /Storm keeper/ }));
    expect(onSelect).toHaveBeenCalledWith("d1");
  });

  it("shows an empty state", () => {
    render(<DreamList dreams={[]} activeId={null} onSelect={() => {}} />);
    expect(screen.getByText(/No dreams yet/)).toBeInTheDocument();
  });
});

describe("InsufficientCredits", () => {
  it("states the shortfall and links to top-up", () => {
    render(<InsufficientCredits balance={3} />);
    expect(screen.getByText(/You need 5 credits to dream/)).toBeInTheDocument();
    expect(screen.getByText(/You have 3 credits left/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buy credits/ })).toHaveAttribute("href", "/credits");
  });
});

describe("VideoPlayer", () => {
  it("points the player and download at the token URLs", () => {
    render(<VideoPlayer dreamId="abc" token="tok" title="Storm keeper" durationSecs={58} />);
    expect(screen.getByTestId("dream-video")).toHaveAttribute(
      "src",
      `${API_URL}/api/v1/dreams/abc/video?token=tok`,
    );
    expect(screen.getByTestId("download-link")).toHaveAttribute(
      "href",
      `${API_URL}/api/v1/dreams/abc/video?download=1&token=tok`,
    );
    expect(screen.getByText("Storm keeper")).toBeInTheDocument();
    expect(screen.getByText(/58s · 720p · MP4/)).toBeInTheDocument();
  });
});
