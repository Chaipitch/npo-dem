import { createElement } from "lwc";
import DashboardCampaigns from "c/tsAbcHopeDashboardCampaigns";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

function mount(campaigns) {
  const el = createElement("c-ts-abc-hope-dashboard-campaigns", {
    is: DashboardCampaigns
  });
  el.campaigns = campaigns;
  document.body.appendChild(el);
  return Promise.resolve().then(() => el);
}

describe("c-ts-abc-hope-dashboard-campaigns", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("campaign cards link to Donate now and View more", async () => {
    const el = await mount([
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
    const $ = (s) => el.shadowRoot.querySelector(s);
    expect($('[data-id="campaign-donate"]').textContent.trim()).toBe(
      "Donate now"
    );
    expect($('[data-id="campaign-donate"]').getAttribute("href")).toBe(
      "/donate?campaign=Clean%20Water%20for%20Rural%20Schools"
    );
    expect($('[data-id="campaign-more"]').getAttribute("href")).toBe(
      "/campaign?name=Clean%20Water%20for%20Rural%20Schools"
    );
    expect($(".campaign-stats").textContent).toContain("raised of USD 300,000");
    expect($(".campaign-meta").textContent).toContain("Be the first to give");
  });

  it("a click on a campaign card opens its detail page", async () => {
    const el = await mount([
      { id: "701a", name: "Christmas Toy Drive 2026", goal: 150000, raised: 0 }
    ]);
    const assign = jest.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...realLocation, assign },
      configurable: true
    });
    try {
      el.shadowRoot.querySelector('[data-id="campaign-card"]').click();
      expect(assign).toHaveBeenCalledWith(
        "/campaign?name=Christmas%20Toy%20Drive%202026"
      );
      assign.mockClear();
      // Links inside the card keep their own target.
      el.shadowRoot.querySelector('[data-id="campaign-donate"]').click();
      expect(assign).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        value: realLocation,
        configurable: true
      });
    }
  });
});
