import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import isGuest from "@salesforce/user/isGuest";

const BENEFIT_ICONS = ["cap", "community", "heart"];

export default class AbcHopeHero extends LightningElement {
  @api headlineStart = "Make Christmas";
  @api headlineHighlight = "Brighter";
  @api body =
    "Help give children the tools to learn, grow and build a brighter tomorrow.";
  @api ctaLabel = "Donate Now";
  @api ctaPath = "/donate";
  @api backgroundImageUrl =
    "https://images.unsplash.com/photo-1606916693216-69bd7e1cf2fa?auto=format&fit=crop&w=2000&q=80";
  @api imageCredit = "Photo: Christian Bowen / Unsplash";
  @api benefits =
    "More Learning Opportunities,Stronger Communities,Brighter Futures";
  @api dashboardPath = "/dashboard";

  sourceCode;

  @wire(CurrentPageReference)
  setPageRef(pageRef) {
    this.sourceCode = pageRef?.state?.src;
  }

  get ctaHref() {
    const path = (this.ctaPath || "/donate").startsWith("/")
      ? this.ctaPath
      : `/${this.ctaPath}`;
    const query = this.sourceCode
      ? `?src=${encodeURIComponent(this.sourceCode)}`
      : "";
    return `${basePath || ""}${path}${query}`;
  }

  get heroClass() {
    return this.backgroundImageUrl ? "hero hero_photo" : "hero";
  }

  get isSignedIn() {
    return !isGuest;
  }

  get dashboardHref() {
    return `${basePath || ""}${this.dashboardPath}`;
  }

  get benefitItems() {
    return String(this.benefits || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .map((label, i) => ({
        key: `b${i}`,
        label,
        icon: BENEFIT_ICONS[i % BENEFIT_ICONS.length]
      }));
  }
}
