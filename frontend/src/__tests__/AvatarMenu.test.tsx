import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AvatarMenu } from "@/components/ui/AvatarMenu";

describe("AvatarMenu (initial icon → profile / sign-out)", () => {
  it("renders the user's initials from their auth name", () => {
    render(<AvatarMenu name="Sunny Gogoi" email="sunny@example.com" onSignOut={() => {}} />);
    expect(screen.getByText("SG")).toBeInTheDocument();
    expect(screen.getByText("Sunny Gogoi")).toBeInTheDocument();
    expect(screen.getByText("sunny@example.com")).toBeInTheDocument();
  });

  it("falls back to the email initial without a name", () => {
    render(<AvatarMenu name="" email="zoe@example.com" onSignOut={() => {}} />);
    expect(screen.getByText("Z")).toBeInTheDocument();
  });

  it("opens the menu with Profile and Sign out entries", async () => {
    render(<AvatarMenu name="Ada" email="ada@example.com" onSignOut={() => {}} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });

  it("fires onSignOut", async () => {
    const onSignOut = vi.fn();
    render(<AvatarMenu name="Ada" email="a@b.co" onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    render(<AvatarMenu name="Ada" email="a@b.co" onSignOut={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    // AnimatePresence exit animation → wait for the element to actually leave
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
