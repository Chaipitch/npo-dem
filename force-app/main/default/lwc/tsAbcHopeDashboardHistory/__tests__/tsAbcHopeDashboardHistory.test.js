import { createElement } from "lwc";
import DashboardHistory from "c/tsAbcHopeDashboardHistory";
import getGivingPage from "@salesforce/apex/TSAbcHopeDonorPortalController.getGivingPage";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
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
jest.mock("@salesforce/apex", () => ({ refreshApex: jest.fn() }), {
  virtual: true
});

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};
const gift = (n) => ({
  id: `g${n}`,
  giftDate: "2025-06-01",
  amount: 100 + n,
  status: "Paid",
  designations: "General Fund"
});

describe("c-ts-abc-hope-dashboard-history", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });
  function mount() {
    const el = createElement("c-ts-abc-hope-dashboard-history", {
      is: DashboardHistory
    });
    document.body.appendChild(el);
    return el;
  }
  const $ = (el, s) => el.shadowRoot.querySelector(s);
  const rows = (el) => el.shadowRoot.querySelectorAll(".table tbody tr");

  it("loads the history one page of 5 at a time", async () => {
    const el = mount();
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
    expect(rows(el)).toHaveLength(5);
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
    expect(rows(el)).toHaveLength(2);
    expect($(el, '[data-id="page-summary"]').textContent).toBe(
      "Showing 11–12 of 12 gifts"
    );
    expect($(el, ".pager-label").textContent).toBe("Page 3 of 3");
    expect($(el, '[data-id="next-page"]').disabled).toBe(true);
  });

  it("shows no pager for 5 gifts or fewer", async () => {
    const el = mount();
    getGivingPage.emit({
      gifts: [1, 2].map(gift),
      total: 2,
      page: 1,
      pageSize: 5
    });
    await flush();
    expect(rows(el)).toHaveLength(2);
    expect($(el, ".pager")).toBeNull();
  });

  it("reloads its page when gifts change", async () => {
    const { refreshApex } = require("@salesforce/apex");
    mount();
    getGivingPage.emit({ gifts: [], total: 0, page: 1, pageSize: 5 });
    await flush();
    refreshApex.mockClear();
    window.dispatchEvent(new CustomEvent("abchope:giftschange"));
    expect(refreshApex).toHaveBeenCalledTimes(1);
  });
});
