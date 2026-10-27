import { createElement } from "lwc";
import CampaignDetail, { formatDate } from "c/tsAbcHopeCampaignDetail";
import getCampaignDetail from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaignDetail";
import { CurrentPageReference } from "lightning/navigation";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaignDetail",
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

const DETAIL = {
  card: {
    id: "701x",
    name: "Clean Water for Rural Schools",
    description: "Water filters for rural schools.",
    goal: 300000,
    raised: 75000,
    giftCount: 3,
    daysLeft: 160,
    endDate: "2027-03-31"
  },
  startDate: "2026-09-01",
  programs: [{ name: "Clean Water", summary: "Filters and handwashing." }],
  causes: [
    {
      name: "Clean Water",
      description: "Water filters and handwashing stations.",
      program: "Clean Water"
    }
  ]
};

const flush = () => Promise.resolve().then(() => Promise.resolve());

async function mount(name, data) {
  const el = createElement("c-ts-abc-hope-campaign-detail", {
    is: CampaignDetail
  });
  document.body.appendChild(el);
  CurrentPageReference.emit({ state: { name } });
  await flush();
  getCampaignDetail.emit(data);
  await flush();
  return el;
}
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const text = (el, sel) => $(el, sel).textContent.replace(/\s+/g, " ").trim();

describe("c-ts-abc-hope-campaign-detail", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows the campaign, its progress, programs, causes and a donate link", async () => {
    const el = await mount("Clean Water for Rural Schools", DETAIL);
    expect(text(el, '[data-id="title"]')).toBe("Clean Water for Rural Schools");
    expect(text(el, ".raised")).toBe("USD 75,000 raised of USD 300,000");
    expect(text(el, ".facts")).toContain("3 gifts");
    expect(text(el, ".facts")).toContain("160 days left");
    expect(text(el, ".facts")).toContain("1 Sept 2026 – 31 Mar 2027");
    expect(text(el, ".programs")).toContain("Filters and handwashing.");
    expect(text(el, ".causes")).toContain("Clean Water program");
    expect($(el, '[data-id="donate"]').getAttribute("href")).toBe(
      "/donate?campaign=Clean%20Water%20for%20Rural%20Schools"
    );
    expect($(el, ".hero-img").src).toContain("photo-1740741705746");
    expect($(el, '[data-id="back"]').getAttribute("href")).toBe(
      "/dashboard#campaigns"
    );
  });

  it("shows a friendly message for an unknown or closed campaign", async () => {
    const el = await mount("Nope", null);
    expect($(el, '[data-id="not-found"]')).not.toBeNull();
    expect($(el, '[data-id="donate"]')).toBeNull();
  });

  it("formats Apex dates without shifting the day", () => {
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDate(null)).toBe("");
  });
});
