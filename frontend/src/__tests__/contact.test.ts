import { describe, expect, it } from "vitest";

import { validateContact } from "@/components/landing/ContactSection";

describe("contact form validation", () => {
  it("accepts a complete submission", () => {
    expect(
      validateContact({
        name: "Ada",
        email: "ada@example.com",
        message: "I dreamed of a storm made of glass.",
      }),
    ).toEqual({});
  });

  it("requires a name", () => {
    const errs = validateContact({ name: "  ", email: "a@b.co", message: "long enough msg" });
    expect(errs.name).toBeTruthy();
  });

  it("rejects malformed emails", () => {
    for (const bad of ["", "a", "a@b", "a b@c.com", "@x.com"]) {
      expect(
        validateContact({ name: "A", email: bad, message: "long enough msg" }).email,
      ).toBeTruthy();
    }
  });

  it("wants at least 10 characters of message", () => {
    expect(validateContact({ name: "A", email: "a@b.co", message: "hi" }).message).toBeTruthy();
    expect(
      validateContact({ name: "A", email: "a@b.co", message: "hello there!" }).message,
    ).toBeUndefined();
  });
});
