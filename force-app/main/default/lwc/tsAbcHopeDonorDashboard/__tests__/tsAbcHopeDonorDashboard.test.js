import { createElement } from "lwc";
import DonorDashboard, { extractLinks } from "c/tsAbcHopeDonorDashboard";
import getDashboard from "@salesforce/apex/TSAbcHopeDonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";
import getGivingPage from "@salesforce/apex/TSAbcHopeDonorPortalController.getGivingPage";
import askAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.ask";
import usesVerifiedAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.usesVerifiedAgent";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.getDashboard",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.getGivingPage",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorAgentController.ask",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorAgentController.usesVerifiedAgent",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock("@salesforce/apex", () => ({ refreshApex: jest.fn() }), {
  virtual: true
});
jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  {
    virtual: true
  }
);

const DASHBOARD = {
  firstName: "Maya",
  donorName: "Maya Grande",
  totalContributions: 2250,
  causesSupported: 2,
  supporterSince: "2023",
  activeMonthlyGifts: 1,
  pausedMonthlyGifts: 0,
  activeRecurringTypes: ["Monthly"],
  activePrograms: 8,
  peopleReached: 1002,
  communities: 2415,
  volunteersEngaged: 96,
  causes: ["General Fund", "Food Insecurity Fund"],
  gifts: [
    {
      id: "g1",
      giftDate: "2025-06-01",
      amount: 1000,
      status: "Paid",
      designations: "Food Insecurity Fund"
    },
    {
      id: "g2",
      giftDate: "2024-03-01",
      amount: 1250,
      status: "Paid",
      designations: "General Fund"
    }
  ],
  journey: [
    { year: "2023", label: "Joined as a supporter", kind: "joined" },
    { year: "2024", label: "Supported General Fund", kind: "cause" }
  ],
  journeyYears: [
    { year: "2023", joined: true, total: 0, giftCount: 0, items: [] },
    {
      year: "2024",
      joined: false,
      total: 1250,
      giftCount: 1,
      items: [
        {
          cause: "General Fund",
          program: "Fund for Children",
          amount: 1250,
          giftCount: 1,
          isNew: true
        },
        { cause: "Toys & Gifts", amount: 0, recurringOnly: true }
      ]
    }
  ]
};

// Lets resolved Apex mocks and the re-render settle (several microtask hops).
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

async function mount() {
  const el = createElement("c-ts-abc-hope-donor-dashboard", {
    is: DonorDashboard
  });
  document.body.appendChild(el);
  getDashboard.emit(DASHBOARD);
  getCampaigns.emit([]);
  await flush();
  return el;
}
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const $$ = (el, sel) => [...el.shadowRoot.querySelectorAll(sel)];
async function ask(el, text) {
  const input = $(el, '[data-id="chat-input"]');
  input.value = text;
  input.dispatchEvent(new CustomEvent("input"));
  $(el, '[data-id="chat-send"]').dispatchEvent(new CustomEvent("click"));
  await flush();
}
const lastReply = (el) => $$(el, ".chat-log .chat-text").pop().textContent;

describe("c-ts-abc-hope-donor-dashboard agent panel", () => {
  beforeAll(() => {
    // jsdom has no layout; the panel scrolls the chat into view after each message.
    Element.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("answers 'how much have I given' from the dashboard data", async () => {
    const el = await mount();
    await ask(el, "How much have I given?");
    expect(lastReply(el)).toBe(
      "You’ve given USD 2,250 in total since 2023, supporting 2 causes."
    );
    expect($(el, ".chat-log a.chat-link").getAttribute("href")).toBe(
      "/my-giving"
    );
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("suggestion chips answer locally", async () => {
    const el = await mount();
    const chip = $$(el, ".agent-chip").find(
      (b) => b.dataset.text === "View giving history"
    );
    chip.dispatchEvent(new CustomEvent("click"));
    await flush();
    expect(lastReply(el)).toContain("Your most recent gifts:");
    expect(lastReply(el)).toContain("USD 1,000 to Food Insecurity Fund");
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("points recurring gift requests to My Giving", async () => {
    const el = await mount();
    await ask(el, "Can I pause my monthly gift?");
    expect(lastReply(el)).toContain("1 active recurring gift (Monthly)");
    expect($(el, ".chat-log a.chat-link").getAttribute("href")).toBe(
      "/my-giving#monthly"
    );
  });

  it("sends other questions to the agent and keeps the session", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-1",
      text: "There are 6 campaigns open."
    });
    const el = await mount();
    await ask(el, "Which campaigns are open?");
    expect(askAgent).toHaveBeenCalledWith({
      message: "Which campaigns are open?",
      sessionId: null
    });
    expect(lastReply(el)).toBe("There are 6 campaigns open.");

    await ask(el, "Tell me about clean water");
    expect(askAgent).toHaveBeenLastCalledWith({
      message: "Tell me about clean water",
      sessionId: "s-1"
    });
  });

  it("shows a friendly error when the agent fails", async () => {
    askAgent.mockRejectedValue({ body: { message: "internal" } });
    const el = await mount();
    await ask(el, "Which campaigns are open?");
    expect(lastReply(el)).toBe("The assistant could not answer right now.");
  });

  it("answers a question sent from the header box on this page", async () => {
    const el = await mount();
    const detail = { question: "How much have I given?", handled: false };
    window.dispatchEvent(new CustomEvent("abchope:ask", { detail }));
    await flush();
    expect(detail.handled).toBe(true);
    expect(lastReply(el)).toContain("USD 2,250");
  });

  it("asks the question from ?ask= after arriving from another page", async () => {
    window.history.replaceState(
      null,
      "",
      "/dashboard?ask=How%20much%20have%20I%20given%3F#agent"
    );
    const el = await mount();
    expect(lastReply(el)).toContain("USD 2,250");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#agent");
    window.history.replaceState(null, "", "/");
  });

  it("with the verified agent, personal questions go to the agent and keep the page link", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-9",
      text: "You have 1 recurring gift: Recurring (Monthly), USD 1,000 per month."
    });
    const el = await mount();
    usesVerifiedAgent.emit(true);
    await flush();
    await ask(el, "Show my recurring gifts");
    expect(askAgent).toHaveBeenCalledWith({
      message: "Show my recurring gifts",
      sessionId: null
    });
    expect(lastReply(el)).toContain("Recurring (Monthly)");
    expect($(el, ".chat-log a.chat-link").getAttribute("href")).toBe(
      "/my-giving#monthly"
    );
  });

  it("shows the agent's donation links as Donate buttons", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-10",
      text: "Which one do you mean?\n1. Christmas Giving 2026 — Donate: https://x.my.site.com/donate?campaign=Christmas%20Giving%202026\n2. Christmas Toy Drive 2026 — Donate: https://x.my.site.com/donate?campaign=Christmas%20Toy%20Drive%202026"
    });
    const el = await mount();
    await ask(el, "I want to donate to Christmas Gift");
    expect(lastReply(el)).not.toContain("https://");
    expect(lastReply(el)).toContain("1. Christmas Giving 2026");
    expect(
      $$(el, ".chat-log a.chat-link").map((a) => [
        a.textContent,
        a.getAttribute("href")
      ])
    ).toEqual([
      [
        "Donate to Christmas Giving 2026",
        "https://x.my.site.com/donate?campaign=Christmas%20Giving%202026"
      ],
      [
        "Donate to Christmas Toy Drive 2026",
        "https://x.my.site.com/donate?campaign=Christmas%20Toy%20Drive%202026"
      ]
    ]);
  });

  it("shows campaign cards when the assistant answers about campaigns", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-11",
      text: "Two campaigns are open: Christmas Toy Drive 2026 and Clean Water. Donate: https://x.my.site.com/donate?campaign=Clean%20Water"
    });
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    getDashboard.emit(DASHBOARD);
    getCampaigns.emit([
      {
        id: "c1",
        name: "Christmas Toy Drive 2026",
        raised: 2500,
        goal: 10000,
        daysLeft: 60
      },
      { id: "c2", name: "Clean Water", raised: 1000, goal: 0 },
      { id: "c3", name: "Green Communities", raised: 0, goal: 5000 }
    ]);
    await flush();
    await ask(el, "Which campaigns are open?");
    const cards = $$(el, '[data-id="chat-cards"] .chat-card');
    expect(
      cards.map((c) => c.querySelector(".chat-card-name").textContent)
    ).toEqual(["Christmas Toy Drive 2026", "Clean Water"]);
    expect(cards[0].textContent).toContain("USD 2,500 raised of USD 10,000");
    expect(
      cards[0].querySelector(".chat-card-donate").getAttribute("href")
    ).toBe("/donate?campaign=Christmas%20Toy%20Drive%202026");
    // The card's Donate button replaces the plain link for that campaign.
    expect($$(el, ".chat-log a.chat-link")).toHaveLength(0);
  });

  it("shows no campaign cards for personal questions", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-12",
      text: "Your last gift went to Clean Water."
    });
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    getDashboard.emit(DASHBOARD);
    getCampaigns.emit([{ id: "c2", name: "Clean Water", raised: 1000 }]);
    await flush();
    await ask(el, "What was my last gift?");
    expect($(el, '[data-id="chat-cards"]')).toBeNull();
  });

  it("with the verified agent, falls back to the dashboard answer when the agent fails", async () => {
    askAgent.mockResolvedValue({
      error: "The assistant could not answer right now. Please try again."
    });
    const el = await mount();
    usesVerifiedAgent.emit(true);
    await flush();
    await ask(el, "How much have I given?");
    expect(lastReply(el)).toContain("USD 2,250");
  });

  it("reloads its data when gifts change (donation or assistant)", async () => {
    const { refreshApex } = require("@salesforce/apex");
    await mount();
    refreshApex.mockClear();
    window.dispatchEvent(new CustomEvent("abchope:giftschange"));
    expect(refreshApex).toHaveBeenCalledTimes(2); // dashboard + campaign cards
  });

  it("fills People Reached, Communities, Programs and Volunteers with live figures", async () => {
    const el = await mount();
    const values = $$(el, ".impact-value").map((v) => v.textContent);
    const labels = $$(el, ".impact-label").map((v) => v.textContent);
    expect(values[labels.indexOf("Programs")]).toBe("8");
    expect(values[labels.indexOf("People Reached")]).toBe("1,002");
    expect(values[labels.indexOf("Volunteers Engaged")]).toBe("96");
    expect(values[labels.indexOf("Communities")]).toBe("2,415");
  });

  it("shows the impact journey as one card per year", async () => {
    const el = await mount();
    const cards = $$(el, '[data-id="journey-year"]');
    expect(cards).toHaveLength(2);
    const text = (n) => n.textContent.replace(/\s+/g, " ").trim();
    expect(text(cards[0].querySelector(".year"))).toBe("2023");
    expect(cards[0].querySelector(".badge_joined")).not.toBeNull();
    expect(text(cards[0].querySelector(".year-empty"))).toBe(
      "Joined ABC Hope as a supporter."
    );
    expect(text(cards[1].querySelector(".year-meta"))).toBe(
      "USD 1,250 · 1 gift"
    );
    const items = [...cards[1].querySelectorAll(".year-item")];
    expect(text(items[0].querySelector(".item-cause"))).toBe("General FundNew");
    expect(items[0].querySelector(".badge_new")).not.toBeNull();
    expect(items[1].querySelector(".badge_new")).toBeNull();
    expect(text(items[0].querySelector(".item-program"))).toBe(
      "Fund for Children"
    );
    expect(text(items[0].querySelector(".item-amount"))).toBe("USD 1,250");
    expect(text(items[1].querySelector(".item-amount"))).toBe("Recurring gift");
  });

  it("campaign cards link to Donate now and View more", async () => {
    const el = await mount();
    getCampaigns.emit([
      {
        id: "701a",
        name: "Clean Water for Rural Schools",
        goal: 300000,
        raised: 0,
        giftCount: 0,
        designations: ["Clean Water"],
        programs: ["Clean Water"]
      }
    ]);
    await flush();
    const donate = $(el, '[data-id="campaign-donate"]');
    const more = $(el, '[data-id="campaign-more"]');
    expect(donate.textContent.trim()).toBe("Donate now");
    expect(donate.getAttribute("href")).toBe(
      "/donate?campaign=Clean%20Water%20for%20Rural%20Schools"
    );
    expect(more.textContent.trim()).toBe("View more");
    expect(more.getAttribute("href")).toBe(
      "/campaign?name=Clean%20Water%20for%20Rural%20Schools"
    );
  });

  it("a click on a campaign card opens its detail page", async () => {
    const el = await mount();
    getCampaigns.emit([
      { id: "701a", name: "Christmas Toy Drive 2026", goal: 150000, raised: 0 }
    ]);
    await flush();
    const assign = jest.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...realLocation, assign },
      configurable: true
    });
    try {
      $(el, '[data-id="campaign-card"]').click();
      expect(assign).toHaveBeenCalledWith(
        "/campaign?name=Christmas%20Toy%20Drive%202026"
      );
      assign.mockClear();
      // Links inside the card keep their own target.
      $(el, '[data-id="campaign-donate"]').click();
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        value: realLocation,
        configurable: true
      });
    }
  });
});

describe("c-ts-abc-hope-donor-dashboard giving history", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });
  const gift = (n) => ({
    id: `g${n}`,
    giftDate: "2025-06-01",
    amount: 100 + n,
    status: "Paid",
    designations: "General Fund"
  });
  function mountGiving() {
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    el.view = "giving";
    document.body.appendChild(el);
    getDashboard.emit(DASHBOARD);
    getCampaigns.emit([]);
    return el;
  }

  it("loads the history one page of 5 at a time", async () => {
    const el = mountGiving();
    await flush();
    expect($(el, ".table")).toBeNull(); // nothing until the first page arrives
    expect(getGivingPage.getLastConfig()).toEqual({ page: 1 });
    getGivingPage.emit({
      gifts: [1, 2, 3, 4, 5].map(gift),
      total: 12,
      page: 1,
      pageSize: 5
    });
    await flush();
    expect($$(el, ".table tbody tr")).toHaveLength(5);
    expect($(el, '[data-id="page-summary"]').textContent).toBe(
      "Showing 1–5 of 12 gifts"
    );
    expect($(el, '[data-id="prev-page"]').disabled).toBe(true);
    $(el, '[data-id="next-page"]').click();
    await flush();
    expect(getGivingPage.getLastConfig()).toEqual({ page: 2 });
    getGivingPage.emit({
      gifts: [11, 12].map(gift),
      total: 12,
      page: 3,
      pageSize: 5
    });
    await flush();
    expect($$(el, ".table tbody tr")).toHaveLength(2);
    expect($(el, '[data-id="page-summary"]').textContent).toBe(
      "Showing 11–12 of 12 gifts"
    );
    expect($(el, ".pager-label").textContent).toBe("Page 3 of 3");
    expect($(el, '[data-id="next-page"]').disabled).toBe(true);
  });

  it("shows no pager for 5 gifts or fewer", async () => {
    const el = mountGiving();
    getGivingPage.emit({
      gifts: [1, 2].map(gift),
      total: 2,
      page: 1,
      pageSize: 5
    });
    await flush();
    expect($$(el, ".table tbody tr")).toHaveLength(2);
    expect($(el, ".pager")).toBeNull();
  });
});

describe("extractLinks", () => {
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
    const single = extractLinks(
      "The Christmas Toy Drive 2026 gives toys.\n\nIt takes a minute. Donate here: URL_Redacted",
      { campaigns: ["Christmas Toy Drive 2026"] }
    );
    expect(single.links[0].label).toBe("Donate to Christmas Toy Drive 2026");
    expect(single.text).toBe(
      "The Christmas Toy Drive 2026 gives toys.\n\nIt takes a minute."
    );
  });
  it("leaves text without links alone", () => {
    expect(extractLinks("No links here.")).toEqual({
      text: "No links here.",
      links: []
    });
  });
});

describe("c-ts-abc-hope-donor-dashboard impact journey", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("scrolls a year's causes when there are more than 5", async () => {
    const items = (n) =>
      Array.from({ length: n }, (_, i) => ({
        cause: `Cause ${i + 1}`,
        amount: 100,
        giftCount: 1
      }));
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    getDashboard.emit({
      ...DASHBOARD,
      journeyYears: [
        { year: "2025", total: 500, giftCount: 5, items: items(5) },
        { year: "2026", total: 1100, giftCount: 11, items: items(11) }
      ]
    });
    getCampaigns.emit([]);
    await flush();
    const lists = $$(el, ".year-items");
    expect(lists).toHaveLength(2);
    expect(lists[0].classList.contains("year-items_scroll")).toBe(false);
    expect(lists[0].getAttribute("tabindex")).toBeNull();
    expect(lists[1].classList.contains("year-items_scroll")).toBe(true);
    expect(lists[1].getAttribute("tabindex")).toBe("0");
    expect(lists[1].querySelectorAll(".year-item")).toHaveLength(11);
  });
});
