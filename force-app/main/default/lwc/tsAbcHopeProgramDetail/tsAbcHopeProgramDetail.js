import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import getProgramDetail from "@salesforce/apex/TSAbcHopeDonationIntakeController.getProgramDetail";
import { campaignPhoto } from "c/tsAbcHopeCampaignPhotos";
import { refreshApex } from "@salesforce/apex";
import { giftsChangedAt } from "c/tsAbcHopeGiftEvents";

// When this page last loaded fresh data in this tab (kept across in-site navigation).
let lastLoadedAt = 0;

/**
 * Public program page (/program?name=…, D-33): the program's story, money raised through its causes,
 * people served and what has been delivered, plus the open campaigns that fund it.
 * Every figure is added up live from gifts, enrollments and benefit deliveries.
 */
export default class ProgramDetail extends LightningElement {
  @api currencyLabel = "USD";

  programName;
  program;
  error;
  loaded = false;

  @wire(CurrentPageReference)
  setPage(ref) {
    const name = ref?.state?.name;
    if (name !== this.programName) {
      this.programName = name;
      this.loaded = !name;
      this.program = undefined;
      this.error = undefined;
    }
  }

  @wire(getProgramDetail, { programName: "$programName" })
  wiredProgram(result) {
    const { data, error } = result;
    // Cached from before a new gift: fetch the current amount raised.
    if (data && giftsChangedAt() > lastLoadedAt) {
      lastLoadedAt = Date.now();
      refreshApex(result);
    }
    if (data !== undefined || error) {
      this.loaded = true;
    }
    this.program = data || undefined;
    this.error = error
      ? error.body?.message || "We could not load this program."
      : undefined;
  }

  get isLoading() {
    return !this.loaded;
  }
  get notFound() {
    return this.loaded && !this.error && !this.program;
  }
  get hasProgram() {
    return !!this.program;
  }
  get photo() {
    return campaignPhoto(this.program?.name, { width: 1400, height: 520 });
  }
  get backHref() {
    return `${basePath || ""}/our-work`;
  }
  get raisedDisplay() {
    const n = Number(this.program?.raised);
    return `${this.currencyLabel} ${formatNumber(Number.isFinite(n) ? n : 0)}`;
  }
  get donorsDisplay() {
    const n = this.program?.donorCount || 0;
    return n ? `from ${formatNumber(n)} donor${n === 1 ? "" : "s"}` : "";
  }
  get peopleDisplay() {
    return formatNumber(this.program?.peopleServed || 0);
  }
  get peopleLabel() {
    return this.program?.peopleServed === 1 ? "person served" : "people served";
  }
  get deliveries() {
    return (this.program?.deliveries || []).map((d, i) => ({
      key: `d${i}`,
      value: formatNumber(d.quantity),
      label: deliveryLabel(d)
    }));
  }
  get hasDeliveries() {
    return this.deliveries.length > 0;
  }
  get campaigns() {
    const base = basePath || "";
    return (this.program?.campaigns || []).map((c, i) => ({
      key: `c${i}`,
      name: c,
      photo: campaignPhoto(c, { width: 240, height: 160 }).url,
      donateHref: `${base}/donate?campaign=${encodeURIComponent(c)}`
    }));
  }
  get hasCampaigns() {
    return this.campaigns.length > 0;
  }
  get causes() {
    return (this.program?.causes || []).map((c, i) => ({
      key: `k${i}`,
      label: c
    }));
  }
  get hasCauses() {
    return this.causes.length > 0;
  }
  get donateHref() {
    const first = this.campaigns[0];
    return first ? first.donateHref : `${basePath || ""}/donate`;
  }
  get donateNote() {
    return this.hasCampaigns
      ? `Gives to ${this.campaigns[0].name}. You choose the cause on the next step.`
      : "No open campaign funds this program right now; your gift goes where it's most needed.";
  }
}

/** "1,240" (whole numbers, en-US grouping). */
export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)
    : "";
}

/** "toy parcels delivered" / "holiday meal delivered": the benefit name, plural unless one. */
export function deliveryLabel(delivery) {
  const name = (delivery?.benefit || "").toLowerCase();
  const plural = Number(delivery?.quantity) === 1 || /s$/.test(name) ? "" : "s";
  return `${name}${plural} delivered`;
}
