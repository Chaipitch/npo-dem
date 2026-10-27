import { LightningElement, api } from "lwc";
import basePath from "@salesforce/community/basePath";

/**
 * Public "About" page (D-26). Placeholder demo copy; every text is a property editable in
 * Experience Builder. Paragraphs and facts are "|"-separated lists.
 */
export default class AbcHopeAbout extends LightningElement {
  @api heading = "About ABC Hope";
  @api lead =
    "ABC Hope helps children and their communities learn, stay healthy and grow — one campaign at a time.";
  @api paragraphs =
    "We run focused fundraising campaigns, like Christmas Giving 2026, that each fund a clear program: education, clean water, green spaces and more.|Donors choose the cause they care about, and every gift is recorded against that cause and program, so you can always see where your support goes.|Signed-in donors can follow their giving, manage recurring gifts and ask our assistant about their impact.";
  @api facts = "8,400|People reached;12|Communities;6|Programs;125|Volunteers";
  @api demoNote =
    "This is a demo site. Payment simulation only — no money is collected.";

  get paragraphItems() {
    return String(this.paragraphs || "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ key: `p${i}`, text }));
  }
  get factItems() {
    return String(this.facts || "")
      .split(";")
      .map((f) => f.split("|").map((x) => x.trim()))
      .filter(([value, label]) => value && label)
      .map(([value, label], i) => ({ key: `f${i}`, value, label }));
  }
  get donateHref() {
    return `${basePath || ""}/donate`;
  }
  get ourWorkHref() {
    return `${basePath || ""}/our-work`;
  }
}
