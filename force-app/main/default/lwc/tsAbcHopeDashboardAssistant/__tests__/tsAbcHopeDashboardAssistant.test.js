import { createElement } from "lwc";
import DashboardAssistant from "c/tsAbcHopeDashboardAssistant";
import askAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.ask";
import usesVerifiedAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.usesVerifiedAgent";
import getMonthlyGifts from "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts";

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
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

const DATA = {
  firstName: "Maya",
  totalContributions: 2250,
  causesSupported: 2,
  supporterSince: "2023",
  activeMonthlyGifts: 1,
  pausedMonthlyGifts: 0,
  activeRecurringTypes: ["Monthly"],
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
    {
      year: "2024",
      items: [
        { cause: "General Fund", amount: 1250 },
        { cause: "Food Insecurity Fund", amount: 1000 }
      ]
    }
  ]
};

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

async function mount({ campaigns = [], data = DATA } = {}) {
  const el = createElement("c-ts-abc-hope-dashboard-assistant", {
    is: DashboardAssistant
  });
  el.data = data;
  el.campaigns = campaigns;
  el.suggestionsConfig =
    "Explore my causes;View giving history;Show next milestones";
  el.acceptsQuestions = true;
  document.body.appendChild(el);
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

describe("c-ts-abc-hope-dashboard-assistant", () => {
  beforeAll(() => {
    // jsdom has no layout; the panel scrolls itself into view.
    Element.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("shows the donor's top causes in the intro", async () => {
    const el = await mount();
    expect($(el, ".agent-intro").textContent).toBe(
      "You’ve supported 2 causes. Here’s where your giving went:"
    );
    expect($$(el, ".agent-row-title").map((n) => n.textContent)).toEqual([
      "General Fund",
      "Food Insecurity Fund"
    ]);
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
    $$(el, ".agent-chip")
      .find((b) => b.dataset.text === "View giving history")
      .dispatchEvent(new CustomEvent("click"));
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

  it("leaves header questions alone when it does not accept them (My Giving)", async () => {
    const el = await mount();
    el.acceptsQuestions = false;
    const detail = { question: "How much have I given?", handled: false };
    window.dispatchEvent(new CustomEvent("abchope:ask", { detail }));
    await flush();
    expect(detail.handled).toBe(false);
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

  it("asks a waiting question once the dashboard data arrives", async () => {
    const el = await mount({ data: null });
    window.dispatchEvent(
      new CustomEvent("abchope:ask", {
        detail: { question: "How much have I given?" }
      })
    );
    await flush();
    expect($(el, ".chat-log")).toBeNull();
    el.data = DATA;
    await flush();
    expect(lastReply(el)).toContain("USD 2,250");
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
      text: "Two campaigns are open: Christmas Toy Drive 2026 and Clean Water."
    });
    const el = await mount({
      campaigns: [
        {
          id: "c1",
          name: "Christmas Toy Drive 2026",
          raised: 2500,
          goal: 10000,
          daysLeft: 60
        },
        { id: "c2", name: "Clean Water", raised: 1000, goal: 0 },
        { id: "c3", name: "Green Communities", raised: 0, goal: 5000 }
      ]
    });
    await ask(el, "Which campaigns are open?");
    const cards = $$(el, '[data-id="chat-cards"] .chat-card');
    expect(
      cards.map((c) => c.querySelector(".chat-card-name").textContent)
    ).toEqual(["Christmas Toy Drive 2026", "Clean Water"]);
    expect(cards[0].textContent).toContain("USD 2,500 raised of USD 10,000");
    expect(
      cards[0].querySelector(".chat-card-donate").getAttribute("href")
    ).toBe("/donate?campaign=Christmas%20Toy%20Drive%202026");
    expect($$(el, ".chat-log a.chat-link")).toHaveLength(0);
  });

  it("shows cards only for the campaigns a reply links to (not given to yet, D-59)", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-13",
      text: "You have given to Christmas Toy Drive 2026. Not yet: Clean Water (Donate: https://x.my.site.com/donate?campaign=Clean%20Water)."
    });
    const el = await mount({
      campaigns: [
        {
          id: "c1",
          name: "Christmas Toy Drive 2026",
          raised: 2500,
          goal: 10000
        },
        { id: "c2", name: "Clean Water", raised: 1000, goal: 0 }
      ]
    });
    await ask(el, "Which campaigns haven't I contributed to?");
    const names = $$(el, '[data-id="chat-cards"] .chat-card-name').map(
      (n) => n.textContent
    );
    expect(names).toEqual(["Clean Water"]);
    // The card's Donate button replaces the plain link for that campaign.
    expect($$(el, ".chat-log a.chat-link")).toHaveLength(0);
  });

  it("shows no campaign cards for personal questions", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-12",
      text: "Your last gift went to Clean Water."
    });
    const el = await mount({
      campaigns: [{ id: "c2", name: "Clean Water", raised: 1000 }]
    });
    await ask(el, "What was my last gift?");
    expect($(el, '[data-id="chat-cards"]')).toBeNull();
  });

  it("shows the recurring gift list as numbered cards (D-55)", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-20",
      text: "Here are your recurring gifts:\n\nRecurring (Monthly): USD 1,000 per month to EF Grady Housing Facility (Capital Campaign) — paused 10/28/2026 to 12/27/2026\n2. Recurring (Yearly): USD 1,000 per year to Handwashing Stations (Clean Water for Rural Schools)\n\nWould you like to pause, resume, change the amount, or cancel any of these gifts?"
    });
    getMonthlyGifts.mockResolvedValue([
      {
        id: "gc1",
        period: "Monthly",
        amount: 1000,
        designation: "EF Grady Housing Facility",
        campaignName: "Capital Campaign",
        isPaused: true,
        pausedFrom: "2026-10-28",
        pausedUntil: "2026-12-27"
      },
      {
        id: "gc2",
        period: "Yearly",
        amount: 1000,
        designation: "Handwashing Stations",
        program: "Clean Water",
        campaignName: "Clean Water for Rural Schools",
        isPaused: false,
        nextGiftDate: "2027-01-01"
      }
    ]);
    const el = await mount();
    usesVerifiedAgent.emit(true);
    await flush();
    await ask(el, "Show my recurring gifts");
    await flush();
    // The intro sits above the cards, the question below them; the gift lines are gone.
    const bubble = $$(el, ".chat-log .bubble_agent").pop();
    const parts = [...bubble.querySelectorAll(".chat-text")].map((p) =>
      p.textContent.trim()
    );
    expect(parts).toEqual([
      "Here are your recurring gifts:",
      "Would you like to pause, resume, change the amount, or cancel any of these gifts?"
    ]);
    expect(bubble.textContent).not.toContain("USD 1,000 per month");
    expect(
      bubble
        .querySelector(".gift-cards")
        .compareDocumentPosition(bubble.querySelector(".chat-text_after")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const cards = $$(el, '[data-id="gift-cards"] .gift-card');
    expect(cards).toHaveLength(2);
    const t = (n, sel) => n.querySelector(sel).textContent.trim();
    expect(t(cards[0], ".gift-number")).toBe("1");
    expect(t(cards[0], ".gift-amount")).toBe("USD 1,000 / month");
    expect(t(cards[0], ".gift-status_paused")).toBe("Paused until 27 Dec 2026");
    expect(t(cards[1], ".gift-type")).toBe("Recurring (Yearly)");
    expect(t(cards[1], ".gift-status_active")).toBe("Active");
    expect(cards[1].textContent).toContain(
      "Handwashing Stations · Clean Water program"
    );
    expect(cards[1].textContent).toContain("Next gift 1 Jan 2027");
  });

  it("keeps the text when the gifts cannot be loaded", async () => {
    askAgent.mockResolvedValue({
      sessionId: "s-21",
      text: "Recurring (Monthly): USD 500 per month to Grocery Vouchers"
    });
    getMonthlyGifts.mockRejectedValue(new Error("offline"));
    const el = await mount();
    await ask(el, "Which campaigns are open?");
    await flush();
    expect(lastReply(el)).toContain("USD 500 per month");
    expect($(el, '[data-id="gift-cards"]')).toBeNull();
  });
});
