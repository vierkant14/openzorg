import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "../states/EmptyState";
import { ErrorState } from "../states/ErrorState";
import { LoadingSkeleton } from "../states/LoadingSkeleton";

describe("EmptyState", () => {
  it("toont titel, uitleg en actie", () => {
    const onActie = vi.fn();
    render(
      <EmptyState
        titel="Nog geen rapportages vandaag"
        uitleg="Begin bij je eerste cliëntbezoek."
        actieLabel="Nieuwe rapportage"
        onActie={onActie}
      />,
    );
    expect(screen.getByText("Nog geen rapportages vandaag")).toBeDefined();
    expect(screen.getByText("Begin bij je eerste cliëntbezoek.")).toBeDefined();
    screen.getByRole("button", { name: "Nieuwe rapportage" }).click();
    expect(onActie).toHaveBeenCalledOnce();
  });

  it("rendert zonder actie geen knop", () => {
    render(<EmptyState titel="Leeg" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("toont melding en herstelactie", () => {
    const onRetry = vi.fn();
    render(<ErrorState melding="Kan rapportages niet laden" onOpnieuw={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Kan rapportages niet laden");
    screen.getByRole("button", { name: "Probeer opnieuw" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("LoadingSkeleton", () => {
  it("is verborgen voor screenreaders en toont het gevraagde aantal regels", () => {
    const { container } = render(<LoadingSkeleton regels={4} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.children.length).toBe(4);
  });
});
