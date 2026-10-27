import { LightningElement, api, wire } from "lwc";
import basePath from "@salesforce/community/basePath";
import getImpact from "@salesforce/apex/TSAbcHopeDonationIntakeController.getImpact";

const number = new Intl.NumberFormat("en-US");

/**
 * Public "About" page (D-26). Placeholder demo copy; every text is a property editable in
 * Experience Builder. Paragraphs are a "|"-separated list. The facts are live totals over active
 * programs (D-46), the same as the dashboard's shared impact (D-34).
 */
export default class AbcHopeAbout extends LightningElement {
  @api heading = "About ABC Hope";
  @api lead =
    "ABC Hope helps children and their communities learn, stay healthy and grow — one campaign at a time.";
  @api paragraphs =
    "We run focused fundraising campaigns, like Christmas Giving 2026, that each fund a clear program: education, clean water, green spaces and more.|Donors choose the cause they care about, and every gift is recorded against that cause and program, so you can always see where your support goes.|Signed-in donors can follow their giving, manage recurring gifts and ask our assistant about their impact.";
  /** No longer used: the facts are live (D-46). Kept because the published page still sets it. */
  @api facts;
  @api demoNote =
    "This is a demo site. Payment simulation only — no money is collected.";

  @wire(getImpact)
  impact;

  get paragraphItems() {
    return String(this.paragraphs || "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ key: `p${i}`, text }));
  }
  /** Empty until the totals load (or if they fail), so no made-up numbers show. */
  get factItems() {
    const i = this.impact?.data;
    if (!i) return [];
    return [
      [i.peopleReached, "People reached"],
      [i.communities, "Communities"],
      [i.programs, "Programs"],
      [i.volunteers, "Volunteers"]
    ].map(([value, label], n) => ({
      key: `f${n}`,
      value: number.format(value || 0),
      label
    }));
  }
  get hasFacts() {
    return this.factItems.length > 0;
  }
  get donateHref() {
    return `${basePath || ""}/donate`;
  }
  get ourWorkHref() {
    return `${basePath || ""}/our-work`;
  }
}
