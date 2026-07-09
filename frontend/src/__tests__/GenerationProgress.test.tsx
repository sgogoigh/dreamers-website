import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GenerationProgress, stageState } from "@/components/studio/GenerationProgress";
import type { SegmentState } from "@/types/api";

const SEGMENTS: SegmentState[] = [
  { beat_no: 1, status: "completed", duration_seconds: 8, is_title_card: false, detail: "clip ready" },
  { beat_no: 2, status: "running", duration_seconds: 8, is_title_card: false, detail: "generating" },
  { beat_no: 3, status: "pending", duration_seconds: 4, is_title_card: true, detail: "" },
];

describe("stageState", () => {
  it("marks earlier stages done, the current active, later pending", () => {
    expect(stageState("rendering", "scripting")).toBe("done");
    expect(stageState("rendering", "prompting")).toBe("done");
    expect(stageState("rendering", "rendering")).toBe("active");
    expect(stageState("rendering", "stitching")).toBe("pending");
  });
  it("completed marks everything done", () => {
    expect(stageState("completed", "stitching")).toBe("done");
    expect(stageState("completed", "scripting")).toBe("done");
  });
  it("queued marks everything pending-ish", () => {
    expect(stageState("queued", "scripting")).toBe("pending");
  });
});

describe("GenerationProgress", () => {
  it("renders the four stages with correct states", () => {
    render(
      <GenerationProgress
        status="rendering"
        progress={0.55}
        message="beat 2: generating"
        segments={SEGMENTS}
        startedAt={null}
      />,
    );
    expect(screen.getByTestId("stage-scripting")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("stage-rendering")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("stage-stitching")).toHaveAttribute("data-state", "pending");
  });

  it("shows progress %, message, and per-segment tiles", () => {
    render(
      <GenerationProgress
        status="rendering"
        progress={0.55}
        message="beat 2: generating"
        segments={SEGMENTS}
        startedAt={null}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "55");
    expect(screen.getByText("beat 2: generating")).toBeInTheDocument();
    expect(screen.getByText("Shots 1/3")).toBeInTheDocument();
    expect(screen.getByTestId("segment-1")).toHaveAttribute("data-status", "completed");
    expect(screen.getByTestId("segment-2")).toHaveAttribute("data-status", "running");
    expect(screen.getByTestId("segment-3")).toHaveAttribute("data-status", "pending");
    // title-card tile is marked with the star, not a number
    expect(screen.getByTestId("segment-3")).toHaveTextContent("✦");
  });

  it("offers no cancel affordance (B5)", () => {
    render(
      <GenerationProgress status="rendering" progress={0.3} message="" segments={[]} startedAt={null} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/can't be stopped/)).toBeInTheDocument();
  });
});
