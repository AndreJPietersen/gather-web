import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

describe("Input", () => {
  it("derives an accessible name from the placeholder when no aria-label is given", () => {
    // This is the Phase 9 accessibility fix: placeholder-only labeling
    // fails WCAG 1.3.1/3.3.2 because it isn't reliably announced by screen
    // readers and disappears once typing starts. Every existing
    // <Input placeholder="..."> call site across the app relies on this
    // exact behavior for its accessible name — regressing it would
    // silently remove labeling from every form in the product at once.
    render(<Input placeholder="Event name" />);
    expect(screen.getByRole("textbox", { name: "Event name" })).toBeInTheDocument();
  });

  it("prefers an explicit aria-label over the placeholder when both are given", () => {
    render(<Input placeholder="Search" aria-label="Search vendors by name" />);
    expect(screen.getByRole("textbox", { name: "Search vendors by name" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search" })).not.toBeInTheDocument();
  });

  it("has no accessible name when neither placeholder nor aria-label is given", () => {
    render(<Input data-testid="bare-input" />);
    const input = screen.getByTestId("bare-input");
    expect(input).not.toHaveAttribute("aria-label");
  });
});
