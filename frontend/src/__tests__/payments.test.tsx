import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AmountStepper, clampAmount, MAX_USD, MIN_USD } from "@/components/payments/AmountStepper";
import { buildPackages, PackagePicker } from "@/components/payments/PackagePicker";

describe("clampAmount (B4: min $5, multiples of $5)", () => {
  it("snaps to $5 steps", () => {
    expect(clampAmount(12)).toBe(10);
    expect(clampAmount(13)).toBe(15);
    expect(clampAmount(15)).toBe(15);
  });
  it("enforces the $5 minimum", () => {
    expect(clampAmount(0)).toBe(MIN_USD);
    expect(clampAmount(-20)).toBe(MIN_USD);
    expect(clampAmount(4)).toBe(MIN_USD);
  });
  it("caps at the maximum", () => {
    expect(clampAmount(9999)).toBe(MAX_USD);
  });
});

describe("AmountStepper", () => {
  it("steps by $5 in both directions", async () => {
    const onChange = vi.fn();
    render(<AmountStepper value={15} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Increase amount" }));
    expect(onChange).toHaveBeenCalledWith(20);
    await userEvent.click(screen.getByRole("button", { name: "Decrease amount" }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("cannot go below the minimum", () => {
    render(<AmountStepper value={5} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Decrease amount" })).toBeDisabled();
  });

  it("shows the 1:1 credit conversion", () => {
    render(<AmountStepper value={25} onChange={() => {}} />);
    expect(screen.getByTestId("stepper-amount")).toHaveTextContent("$25");
    expect(screen.getByText("= 25 credits")).toBeInTheDocument();
  });
});

describe("PackagePicker", () => {
  it("builds the standard packages with video math", () => {
    const packages = buildPackages(5);
    expect(packages.map((p) => p.usd)).toEqual([5, 10, 25, 50]);
    expect(packages.map((p) => p.credits)).toEqual([5, 10, 25, 50]); // $1 = 1 credit
    expect(packages.map((p) => p.videos)).toEqual([1, 2, 5, 10]);
  });

  it("marks the selected package and fires onSelect", async () => {
    const onSelect = vi.fn();
    render(<PackagePicker selected={25} onSelect={onSelect} />);
    const chosen = screen.getByRole("button", { name: /\$25/ });
    expect(chosen).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /\$10/ }));
    expect(onSelect).toHaveBeenCalledWith(10);
  });
});
