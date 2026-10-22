import { createElement } from "lwc";
import DonorDashboard from "c/donorDashboard";
import getDashboard from "@salesforce/apex/DonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/DonationIntakeController.getCampaigns";
import askAgent from "@salesforce/apex/DonorAgentController.ask";

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
      "You’ve given THB 2,250 in total since 2023, supporting 2 causes."
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
    expect(lastReply(el)).toContain("THB 1,000 to Food Insecurity Fund");
    expect(askAgent).not.toHaveBeenCalled();
  });

  it("points monthly gift requests to My Giving", async () => {
    const el = await mount();
    await ask(el, "Can I pause my monthly gift?");
    expect(lastReply(el)).toContain("1 active monthly gift");
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
});
