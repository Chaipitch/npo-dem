import { createElement } from "lwc";
import AbcHopeOurWork from "c/tsAbcHopeOurWork";
import getPrograms from "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms",
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

describe("c-ts-abc-hope-our-work", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("lists programs with the campaigns and causes that fund them", async () => {
    const el = createElement("c-ts-abc-hope-our-work", { is: AbcHopeOurWork });
    document.body.appendChild(el);
    getPrograms.emit([
      {
        name: "Education Access",
        summary: "School supplies and scholarships.",
        campaigns: ["Christmas Giving 2026"],
        causes: ["School Supplies", "Learning Kits"],
        raised: 9421,
        peopleReached: 3171,
        deliveries: [{ benefit: "Storybook", quantity: 159, unit: "Items" }]
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
    expect(
      cards[0].querySelector('[data-id="program-link"]').getAttribute("href")
    ).toBe("/program?name=Education%20Access");
    expect(
      [...cards[0].querySelectorAll(".figure")].map((f) =>
        f.textContent.replace(/\s+/g, " ").trim()
      )
    ).toEqual([
      "USD 9,421raised",
      "3,171people reached",
      "159storybooks delivered"
    ]);
    // Nothing to show for a program without gifts or deliveries.
    expect(cards[1].querySelectorAll(".figure")).toHaveLength(0);
  });

  it("shows a friendly error", async () => {
    const el = createElement("c-ts-abc-hope-our-work", { is: AbcHopeOurWork });
    document.body.appendChild(el);
    getPrograms.error({ message: "boom" });
    await flush();
    expect(el.shadowRoot.querySelector(".alert").textContent).toBe(
      "We could not load our programs right now."
    );
  });
});
