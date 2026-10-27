import { createElement } from "lwc";
import DonorDashboard from "c/donorDashboard";
import getDashboard from "@salesforce/apex/DonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/DonationIntakeController.getCampaigns";
import askAgent from "@salesforce/apex/DonorAgentController.ask";
import usesVerifiedAgent from "@salesforce/apex/DonorAgentController.usesVerifiedAgent";

jest.mock(
  "@salesforce/apex/DonorPortalController.getDashboard",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/DonationIntakeController.getCampaigns",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/DonorAgentController.ask",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/DonorAgentController.usesVerifiedAgent",
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
  const el = createElement("c-donor-dashboard", { is: DonorDashboard });
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

describe("c-donor-dashboard agent panel", () => {
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
