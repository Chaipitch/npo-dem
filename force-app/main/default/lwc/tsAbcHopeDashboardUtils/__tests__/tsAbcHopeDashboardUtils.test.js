import {
  campaignCards,
  chatList,
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

  it("finds the list in a chat reply (D-60)", () => {
    const gifts = chatList(
      "Here are your gifts:\n\nUSD 1,000 on 10/28/2026 to Toys & Gifts (Christmas Toy Drive 2026)\nUSD 300 on 1/5/2026\n\nAnything else?"
    );
    expect(gifts.before).toBe("Here are your gifts:");
    expect(gifts.after).toBe("Anything else?");
    expect(gifts.gifts).toBe(true);
    expect(gifts.items[0]).toMatchObject({
      title: "USD 1,000",
      date: "28 Oct 2026",
      detail: "Toys & Gifts",
      campaign: "Christmas Toy Drive 2026"
    });
    expect(gifts.items[1]).toMatchObject({
      title: "USD 300",
      date: "5 Jan 2026",
      detail: "",
      campaign: ""
    });

    // Date first, as the agent also writes it, and the dashboard's own "1 Jun 2025: …" lines.
    expect(
      chatList(
        "10/27/2026: USD 1,000 to Handwashing Stations (Clean Water for Rural Schools)\n1 Jun 2025: USD 50 to Food"
      ).items.map((i) => [i.title, i.date, i.detail, i.campaign])
    ).toEqual([
      [
        "USD 1,000",
        "27 Oct 2026",
        "Handwashing Stations",
        "Clean Water for Rural Schools"
      ],
      ["USD 50", "1 Jun 2025", "Food", ""]
    ]);

    const titled = chatList(
      "Which one?\n1. **Clean Water** — wells\n2) Books: reading for kids"
    );
    expect(titled.before).toBe("Which one?");
    expect(titled.gifts).toBe(false);
    expect(titled.items.map((i) => [i.title, i.detail])).toEqual([
      ["Clean Water", "wells"],
      ["Books", "reading for kids"]
    ]);

    // Paragraphs and a single line are text, not a list.
    expect(chatList("Hi Maya!\n\nYou gave USD 5.").items).toEqual([]);
    expect(chatList("Your gifts:\n- one").items).toEqual([]);
    expect(chatList("").before).toBe("");
  });
});
