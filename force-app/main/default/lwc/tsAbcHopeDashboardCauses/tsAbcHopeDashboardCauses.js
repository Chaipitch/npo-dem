import { LightningElement, api } from "lwc";

/** Donor dashboard "Causes I Support" chips (D-51). */
export default class DashboardCauses extends LightningElement {
  /** Cause names, A–Z. */
  @api items = [];

  get causes() {
    return (this.items || []).map((c, i) => ({ key: `c${i}`, label: c }));
  }
  get hasCauses() {
    return this.causes.length > 0;
  }
}
