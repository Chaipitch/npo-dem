import { createElement } from "lwc";
import DashboardKpis from "c/tsAbcHopeDashboardKpis";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

describe("c-ts-abc-hope-dashboard-kpis", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows the totals and the recurring line with Manage on the home view", async () => {
    const el = createElement("c-ts-abc-hope-dashboard-kpis", {
      is: DashboardKpis
    });
    el.data = {
      totalContributions: 2250,
      causesSupported: 2,
      supporterSince: "2023",
      activeMonthlyGifts: 1,
      activeRecurringTypes: ["Monthly"]
    };
    el.showManage = true;
    document.body.appendChild(el);
    await Promise.resolve();
    const values = [...el.shadowRoot.querySelectorAll(".kpi-value")].map(
      (v) => v.textContent
    );
    expect(values).toEqual(["USD 2,250", "2", "Since 2023"]);
    expect(el.shadowRoot.querySelector(".monthly").textContent).toContain(
      "1 active recurring gift (Monthly)"
    );
    expect(
      el.shadowRoot.querySelector(".monthly-manage").getAttribute("href")
    ).toBe("/my-giving#monthly");
    el.showManage = false;
    await Promise.resolve();
    expect(el.shadowRoot.querySelector(".monthly-manage")).toBeNull();
  });
});
