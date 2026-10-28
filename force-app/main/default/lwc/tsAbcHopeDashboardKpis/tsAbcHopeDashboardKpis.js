import { LightningElement, api } from "lwc";
import { money, recurringSummary, sitePath } from "c/tsAbcHopeDashboardUtils";

/** Donor dashboard KPI cards (total, causes, supporter since) and the recurring gift line (D-51). */
export default class DashboardKpis extends LightningElement {
  /** The dashboard summary (TSAbcHopeDonorPortalController.getDashboard). */
  @api data;
  @api currencyLabel = "USD";
  /** Show the "Manage" link next to the recurring line (the home view; My Giving already shows the gifts). */
  @api showManage = false;

  get totalDisplay() {
    return money(this.data?.totalContributions || 0, this.currencyLabel);
  }
  get causesDisplay() {
    return this.data?.causesSupported ?? 0;
  }
  get sinceDisplay() {
    return this.data ? `Since ${this.data.supporterSince}` : "";
  }
  get monthlyNote() {
    return recurringSummary(this.data);
  }
  get givingHref() {
    return sitePath("/my-giving");
  }
  get causesHref() {
    return sitePath("/dashboard#causes");
  }
  get journeyHref() {
    return sitePath("/dashboard#journey");
  }
  get manageMonthlyHref() {
    return sitePath("/my-giving#monthly");
  }
}
