import { createElement } from "lwc";
import DonorDashboard from "c/tsAbcHopeDonorDashboard";
import getDashboard from "@salesforce/apex/TSAbcHopeDonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";

// The container's own job (D-51): load the data, lay out the sections and pass the data down.
// Each section has its own tests (c/tsAbcHopeDashboard*).
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
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts",
  () => ({ default: jest.fn().mockResolvedValue([]) }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.manageMonthlyGift",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock("@salesforce/apex", () => ({ refreshApex: jest.fn() }), {
  virtual: true
});
jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

const DASHBOARD = {
  firstName: "Maya",
  totalContributions: 2250,
  causesSupported: 2,
  supporterSince: "2023",
  activePrograms: 8,
  causes: ["General Fund", "Food Insecurity Fund"],
  gifts: [],
  journey: [],
  journeyYears: [{ year: "2023", joined: true, items: [] }]
};
const CAMPAIGNS = [{ id: "c1", name: "Clean Water", raised: 0, goal: 1000 }];

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

async function mount(view) {
  const el = createElement("c-ts-abc-hope-donor-dashboard", {
    is: DonorDashboard
  });
  if (view) el.view = view;
  document.body.appendChild(el);
  getDashboard.emit(DASHBOARD);
  getCampaigns.emit(CAMPAIGNS);
  await flush();
  return el;
}
const child = (el, name) => el.shadowRoot.querySelector(name);

describe("c-ts-abc-hope-donor-dashboard", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("shows a loading line until the summary arrives", () => {
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector('[role="status"]').textContent).toBe(
      "Loading your giving summary…"
    );
    expect(child(el, "c-ts-abc-hope-dashboard-kpis")).toBeNull();
  });

  it("shows the error when the summary fails", async () => {
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    getDashboard.error({
      message: "Please sign in to view your donor profile."
    });
    await flush();
    expect(el.shadowRoot.querySelector(".alert")).not.toBeNull();
  });

  it("home view: passes the data to every section", async () => {
    const el = await mount();
    expect(child(el, "c-ts-abc-hope-dashboard-banner").heading).toBe(
      "See What We’ve Achieved Together"
    );
    expect(child(el, "c-ts-abc-hope-dashboard-kpis").data).toEqual(DASHBOARD);
    expect(child(el, "c-ts-abc-hope-dashboard-kpis").showManage).toBe(true);
    expect(child(el, "c-ts-abc-hope-dashboard-campaigns").campaigns).toEqual(
      CAMPAIGNS
    );
    expect(child(el, "c-ts-abc-hope-dashboard-impact").data).toEqual(DASHBOARD);
    expect(child(el, "c-ts-abc-hope-dashboard-stories").config).toContain(
      "Clean Water"
    );
    expect(child(el, "c-ts-abc-hope-dashboard-causes").items).toEqual(
      DASHBOARD.causes
    );
    expect(child(el, "c-ts-abc-hope-dashboard-journey").years).toEqual(
      DASHBOARD.journeyYears
    );
    const assistant = child(el, "c-ts-abc-hope-dashboard-assistant");
    expect(assistant.data).toEqual(DASHBOARD);
    expect(assistant.acceptsQuestions).toBe(true);
    expect(child(el, "c-ts-abc-hope-dashboard-history")).toBeNull();
    expect(child(el, "c-ts-abc-hope-donor-monthly-gifts")).toBeNull();
  });

  it("giving view: recurring gifts and the paged history, no home sections", async () => {
    const el = await mount("giving");
    expect(child(el, "c-ts-abc-hope-dashboard-banner").heading).toBe(
      "My Giving"
    );
    expect(child(el, "c-ts-abc-hope-donor-monthly-gifts")).not.toBeNull();
    expect(child(el, "c-ts-abc-hope-dashboard-history")).not.toBeNull();
    expect(child(el, "c-ts-abc-hope-dashboard-campaigns")).toBeNull();
    expect(child(el, "c-ts-abc-hope-dashboard-journey")).toBeNull();
    expect(child(el, "c-ts-abc-hope-dashboard-kpis").showManage).toBe(false);
    expect(
      child(el, "c-ts-abc-hope-dashboard-assistant").acceptsQuestions
    ).toBe(false);
  });

  it("hides the campaign section when no campaign is open", async () => {
    const el = createElement("c-ts-abc-hope-donor-dashboard", {
      is: DonorDashboard
    });
    document.body.appendChild(el);
    getDashboard.emit(DASHBOARD);
    getCampaigns.emit([]);
    await flush();
    expect(child(el, "c-ts-abc-hope-dashboard-campaigns")).toBeNull();
    expect(
      el.shadowRoot.querySelector('[data-section="campaigns"]')
    ).toBeNull();
  });

  it("reloads its data when gifts change (donation or assistant)", async () => {
    const { refreshApex } = require("@salesforce/apex");
    await mount();
    refreshApex.mockClear();
    window.dispatchEvent(new CustomEvent("abchope:giftschange"));
    expect(refreshApex).toHaveBeenCalledTimes(2); // summary + campaign cards
  });

  it("scrolls to the section named in the URL", async () => {
    window.history.replaceState(null, "", "/dashboard#journey");
    await mount();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    window.history.replaceState(null, "", "/");
  });
});
