import { createElement } from "lwc";
import AbcHopeOurWork from "c/abcHopeOurWork";
import getPrograms from "@salesforce/apex/DonationIntakeController.getPrograms";

jest.mock(
  "@salesforce/apex/DonationIntakeController.getPrograms",
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

const flush = () => Promise.resolve().then(() => Promise.resolve());
const $$ = (el, s) => [...el.shadowRoot.querySelectorAll(s)];

describe("c-abc-hope-our-work", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("lists programs with the campaigns and causes that fund them", async () => {
    const el = createElement("c-abc-hope-our-work", { is: AbcHopeOurWork });
    document.body.appendChild(el);
    getPrograms.emit([
      {
        name: "Education Access",
        summary: "School supplies and scholarships.",
        campaigns: ["Christmas Giving 2026"],
        causes: ["School Supplies", "Learning Kits"]
      },
      { name: "Food Access", summary: "", campaigns: [], causes: [] }
    ]);
    await flush();
    const cards = $$(el, '[data-id="program"]');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector(".name").textContent).toBe(
      "Education Access"
    );
    expect(
      cards[0].querySelector('[data-id="campaign-link"]').getAttribute("href")
    ).toBe("/donate?campaign=Christmas%20Giving%202026");
    expect(
      [...cards[0].querySelectorAll(".chip")].map((c) => c.textContent)
    ).toEqual(["School Supplies", "Learning Kits"]);
    expect(cards[1].querySelector('[data-id="no-campaign"]')).not.toBeNull();
  });

  it("shows a friendly error", async () => {
    const el = createElement("c-abc-hope-our-work", { is: AbcHopeOurWork });
    document.body.appendChild(el);
    getPrograms.error({ message: "boom" });
    await flush();
    expect(el.shadowRoot.querySelector(".alert").textContent).toBe(
      "We could not load our programs right now."
    );
  });
});
