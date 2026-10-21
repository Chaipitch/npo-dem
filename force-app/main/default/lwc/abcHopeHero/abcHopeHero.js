import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";

export default class AbcHopeHero extends LightningElement {
  @api headlineStart = "Make Christmas";
  @api headlineHighlight = "Brighter";
  @api body =
    "Help give children the tools to learn, grow and build a brighter tomorrow.";
  @api ctaLabel = "Donate Now";
  @api ctaPath = "/donate";
  @api backgroundImageUrl;
  @api benefits =
    "More Learning Opportunities,Stronger Communities,Brighter Futures";

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

  get heroStyle() {
    return this.backgroundImageUrl
      ? `background-image: linear-gradient(90deg, rgba(20,10,10,.82) 0%, rgba(20,10,10,.45) 55%, rgba(20,10,10,.1) 100%), url("${encodeURI(this.backgroundImageUrl)}");`
      : "";
  }

  get benefitItems() {
    const icons = ["🎓", "🤝", "❤"];
    return String(this.benefits || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .map((label, i) => ({
        key: `b${i}`,
        label,
        icon: icons[i % icons.length]
      }));
  }
}
