import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, LinkButton } from "./button";

describe("Button", () => {
  it("renders its children and responds to clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and non-interactive when the disabled prop is set", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submitting…
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Submitting…" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("always carries a visible focus ring, regardless of variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    // Every button/LinkButton in this app was completely untabbable-to
    // with confidence via keyboard until Phase 9 added this — regressing
    // it would silently remove focus visibility app-wide.
    expect(screen.getByRole("button")).toHaveClass("focus-visible:ring-2");
  });
});

describe("LinkButton", () => {
  it("renders as a real anchor, not a nested button", () => {
    render(
      <LinkButton href="/events/new" variant="primary">
        New Event
      </LinkButton>,
    );

    const link = screen.getByRole("link", { name: "New Event" });
    expect(link.tagName).toBe("A");
    expect(link.querySelector("button")).toBeNull();
    expect(link).toHaveAttribute("href", "/events/new");
  });
});
