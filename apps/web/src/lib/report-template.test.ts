import { describe, expect, it } from "vitest";
import { defaultOpinionPhaseText, syncOpinionPhaseTextWithVerdict } from "./report-template";

const opinion = (verdict: string) =>
  `Based on the diagnostic evaluations and analysis of the polygrams, I am of the opinion that the examination conducted on SAKAOCHAI WONGSUWAN concluded as ${verdict}.`;

describe("syncOpinionPhaseTextWithVerdict", () => {
  it("swaps the verdict in plain text", () => {
    expect(syncOpinionPhaseTextWithVerdict(opinion("Truthful"), "Inconclusive")).toBe(opinion("Inconclusive"));
    expect(syncOpinionPhaseTextWithVerdict(opinion("Truthful"), "DI")).toBe(opinion("Not Truthful"));
    expect(syncOpinionPhaseTextWithVerdict(opinion("Not Truthful"), "NDI")).toBe(opinion("Truthful"));
  });

  it("swaps the verdict in the editor's HTML", () => {
    const html = `<p>${opinion("Truthful")}</p>`;
    expect(syncOpinionPhaseTextWithVerdict(html, "Inconclusive")).toBe(`<p>${opinion("Inconclusive")}</p>`);
    expect(syncOpinionPhaseTextWithVerdict(`<p>${opinion("Inconclusive")}</p><p>Second paragraph.</p>`, "DI")).toBe(
      `<p>${opinion("Not Truthful")}</p><p>Second paragraph.</p>`,
    );
  });

  it("keeps formatting around the verdict and the examiner's other wording", () => {
    const html = "<p>Edited by examiner: the exam concluded as <strong>Truthful</strong>. Extra note.</p>";
    expect(syncOpinionPhaseTextWithVerdict(html, "DI")).toBe(
      "<p>Edited by examiner: the exam concluded as <strong>Not Truthful</strong>. Extra note.</p>",
    );
  });

  it("uses the forensic wording when the client asks for it", () => {
    expect(syncOpinionPhaseTextWithVerdict(`<p>${opinion("Truthful")}</p>`, "DI", "forensic")).toBe(
      `<p>${opinion("Deception Indicated (DI)")}</p>`,
    );
    expect(syncOpinionPhaseTextWithVerdict(opinion("Deception Indicated (DI)"), "NDI", "forensic")).toBe(
      opinion("No Deception Indicated (NDI)"),
    );
  });

  it("handles text without 'concluded as'", () => {
    expect(syncOpinionPhaseTextWithVerdict("<p>The result was assessed as Truthful.</p>", "DI")).toBe(
      "<p>The result was assessed as Not Truthful.</p>",
    );
    expect(syncOpinionPhaseTextWithVerdict("<p>Result: {{verdict_label}}</p>", "Inconclusive")).toBe("<p>Result: Inconclusive</p>");
    expect(syncOpinionPhaseTextWithVerdict("<p>No verdict mentioned here.</p>", "DI")).toBe("<p>No verdict mentioned here.</p>");
    expect(syncOpinionPhaseTextWithVerdict("", "DI", "plain", "A B")).toBe(defaultOpinionPhaseText("A B", "DI"));
  });
});
