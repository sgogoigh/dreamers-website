import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PromptComposer } from "@/components/studio/PromptComposer";

describe("PromptComposer (the chat bar)", () => {
  it("shows the cost line with the user's balance", () => {
    render(<PromptComposer onSubmit={() => {}} balance={10} costPerVideo={5} />);
    expect(screen.getByText(/5 credits/)).toBeInTheDocument();
    expect(screen.getByText(/you\s*have 10/)).toBeInTheDocument();
  });

  it("counts characters", async () => {
    render(<PromptComposer onSubmit={() => {}} />);
    await userEvent.type(screen.getByLabelText("Describe your dream"), "hello");
    expect(screen.getByTestId("char-count")).toHaveTextContent("5/2000");
  });

  it("blocks submission under the minimum length", async () => {
    const onSubmit = vi.fn();
    render(<PromptComposer onSubmit={onSubmit} minLen={3} />);
    const button = screen.getByRole("button", { name: "Dream it" });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Describe your dream"), "ab");
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Describe your dream"), "c");
    expect(button).toBeEnabled();
  });

  it("submits the trimmed prompt and clears", async () => {
    const onSubmit = vi.fn();
    render(<PromptComposer onSubmit={onSubmit} />);
    const box = screen.getByLabelText("Describe your dream");
    await userEvent.type(box, "  a lighthouse dream  ");
    await userEvent.click(screen.getByRole("button", { name: "Dream it" }));
    expect(onSubmit).toHaveBeenCalledWith("a lighthouse dream");
    expect(box).toHaveValue("");
  });

  it("submits with Ctrl+Enter", async () => {
    const onSubmit = vi.fn();
    render(<PromptComposer onSubmit={onSubmit} />);
    const box = screen.getByLabelText("Describe your dream");
    await userEvent.type(box, "storm story");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onSubmit).toHaveBeenCalledWith("storm story");
  });

  it("disabled state surfaces the reason and blocks input", () => {
    const onSubmit = vi.fn();
    render(
      <PromptComposer
        onSubmit={onSubmit}
        disabled
        disabledReason="Your dream is rendering — one at a time ✦"
      />,
    );
    expect(screen.getByLabelText("Describe your dream")).toBeDisabled();
    expect(screen.getAllByText(/one at a time/)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dream it" })).toBeDisabled();
  });
});
