import {
  campaignCards,
  extractLinks,
  money,
  recurringSummary
} from "c/tsAbcHopeDashboardUtils";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

describe("tsAbcHopeDashboardUtils", () => {
  it("formats money and the recurring summary", () => {
    expect(money(1250.6)).toBe("USD 1,251");
    expect(money("x", "THB")).toBe("THB 0");
    expect(
      recurringSummary({
        activeMonthlyGifts: 2,
        activeRecurringTypes: ["Monthly", "Weekly"],
        pausedMonthlyGifts: 1,
        pausedUntil: "2026-12-22"
      })
    ).toBe(
      "2 active recurring gifts (Monthly, Weekly) · 1 paused until 22 Dec 2026"
    );
    expect(recurringSummary({})).toBe("");
  });

  it("builds campaign cards with links, progress and timing", () => {
    const [card] = campaignCards(
      [
        {
          id: "c1",
          name: "Christmas Toy Drive 2026",
          goal: 10000,
          raised: 2500,
          daysLeft: 1,
          giftCount: 3,
          programs: ["Child Wellbeing"],
          designations: ["Toys & Gifts"]
        }
      ],
      {
        campaignImages:
          "Christmas Toy Drive 2026|https://img.test/toys.jpg|Photo: Test"
      }
    );
    expect(card).toMatchObject({
      href: "/donate?campaign=Christmas%20Toy%20Drive%202026",
      detailHref: "/campaign?name=Christmas%20Toy%20Drive%202026",
      imageUrl: "https://img.test/toys.jpg",
      raisedDisplay: "USD 2,500",
      goalDisplay: "USD 10,000",
      pctDisplay: "25%",
      timing: "1 day left",
      giftsDisplay: "3 gifts",
      programsDisplay: "Child Wellbeing"
    });
  });

  it("a campaign's own Image URL wins over the dashboard setting and the theme photo", () => {
    const [own, configured] = campaignCards(
      [
        {
          id: "c1",
          name: "Christmas Toy Drive 2026",
          imageUrl: "https://cdn.test/toys.jpg"
        },
        { id: "c2", name: "Clean Water" }
      ],
      {
        campaignImages:
          "Christmas Toy Drive 2026|https://img.test/old.jpg|Photo: Old;Clean Water|https://img.test/water.jpg|Photo: W"
      }
    );
    expect(own.imageUrl).toBe("https://cdn.test/toys.jpg");
    expect(configured.imageUrl).toBe("https://img.test/water.jpg");
  });

  it("turns markdown and bare links into labelled buttons", () => {
    const r = extractLinks(
      "Great choice! [Donate now](https://x.site/donate?campaign=Christmas%20Toy%20Drive%202026). Donate here: https://x.site/donate. See https://x.site/about"
    );
    expect(r.links.map((l) => l.label)).toEqual([
      "Donate to Christmas Toy Drive 2026",
      "Donate",
      "Open link"
    ]);
    expect(r.text).toBe("Great choice! Donate now. See");
  });

  it("rebuilds links Agentforce redacted from the campaign named before them", () => {
    const r = extractLinks(
      "Which one?\n\nChristmas Toy Drive 2026 — Toys for children. Donate: URL_Redacted\n\nChristmas Giving 2026 — School supplies. Donate: URL_Redacted\n\nNo payment is collected.",
      {
        campaigns: ["Christmas Giving 2026", "Christmas Toy Drive 2026"],
        donatePath: "/donate"
      }
    );
    expect(r.links).toEqual([
      {
        href: "/donate?campaign=Christmas%20Toy%20Drive%202026",
        label: "Donate to Christmas Toy Drive 2026"
      },
      {
        href: "/donate?campaign=Christmas%20Giving%202026",
        label: "Donate to Christmas Giving 2026"
      }
    ]);
    expect(r.text).not.toMatch(/redacted/i);
  });

  it("leaves text without links alone", () => {
    expect(extractLinks("No links here.")).toEqual({
      text: "No links here.",
      links: []
    });
  });
});
