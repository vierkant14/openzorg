import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "../layout/PageHeader";
import { Section } from "../layout/Section";

describe("PageHeader", () => {
  it("rendert h1-titel, omschrijving en acties", () => {
    render(
      <PageHeader titel="Vandaag" omschrijving="Donderdag 12 juni">
        <button>Actie</button>
      </PageHeader>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Vandaag" })).toBeDefined();
    expect(screen.getByText("Donderdag 12 juni")).toBeDefined();
    expect(screen.getByRole("button", { name: "Actie" })).toBeDefined();
  });
});

describe("Section", () => {
  it("rendert h2-kop met inhoud en optionele actie", () => {
    render(
      <Section titel="Open taken" actie={<a href="/werkbak">Alles</a>}>
        <p>inhoud</p>
      </Section>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Open taken" })).toBeDefined();
    expect(screen.getByText("inhoud")).toBeDefined();
    expect(screen.getByRole("link", { name: "Alles" })).toBeDefined();
  });
});
