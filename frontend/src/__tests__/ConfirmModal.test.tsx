import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmModal } from "@/components/studio/ConfirmModal";

describe("ConfirmModal (business rule B5 — the single point of no return)", () => {
  it("echoes the exact prompt and the irreversibility warning", () => {
    render(
      <ConfirmModal prompt="a whale made of stars" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/Is this prompt final\?/)).toBeInTheDocument();
    expect(screen.getByText(/a whale made of stars/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be stopped/)).toBeInTheDocument();
    expect(screen.getByText(/5 credits/)).toBeInTheDocument();
  });

  it("renders nothing when prompt is null", () => {
    render(<ConfirmModal prompt={null} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirm fires exactly once, even on rapid double-click", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal prompt="p" onConfirm={onConfirm} onCancel={() => {}} />);
    const btn = screen.getByRole("button", { name: /Dream it/ });
    await userEvent.dblClick(btn);
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Edit prompt cancels", async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal prompt="p" onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit prompt" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels (but not while busy)", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmModal prompt="p" onConfirm={() => {}} onCancel={onCancel} />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<ConfirmModal prompt="p" busy onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1); // unchanged
  });
});
