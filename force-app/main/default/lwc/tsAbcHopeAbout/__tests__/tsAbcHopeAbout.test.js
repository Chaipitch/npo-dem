import { createElement } from "lwc";
import AbcHopeAbout from "c/tsAbcHopeAbout";
import getImpact from "@salesforce/apex/TSAbcHopeDonationIntakeController.getImpact";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getImpact",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

describe("c-ts-abc-hope-about", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("renders the placeholder copy, live facts, links and demo note", async () => {
    const el = createElement("c-ts-abc-hope-about", { is: AbcHopeAbout });
    document.body.appendChild(el);
    const $ = (s) => el.shadowRoot.querySelector(s);
    expect($(".title").textContent).toBe("About ABC Hope");
    expect(el.shadowRoot.querySelectorAll(".para")).toHaveLength(3);
    expect($(".facts")).toBeNull(); // no numbers until the totals load
    getImpact.emit({
      programs: 10,
      peopleReached: 17172,
      communities: 2415,
      volunteers: 1093
    });
    await Promise.resolve();
    const facts = [...el.shadowRoot.querySelectorAll(".fact")].map((f) => [
      f.querySelector(".fact-value").textContent,
      f.querySelector(".fact-label").textContent
    ]);
    expect(facts).toEqual([
      ["17,172", "People reached"],
      ["2,415", "Communities"],
      ["10", "Programs"],
      ["1,093", "Volunteers"]
    ]);
    expect($('[data-id="donate"]').getAttribute("href")).toBe("/donate");
    expect($('[data-id="our-work"]').getAttribute("href")).toBe("/our-work");
    expect($('[data-id="demo-note"]').textContent).toContain(
      "Payment simulation only"
    );
  });
});
