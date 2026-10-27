import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import getCampaignDetail from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaignDetail";
import { campaignPhoto } from "c/tsAbcHopeCampaignPhotos";
import { refreshApex } from "@salesforce/apex";
import { giftsChangedAt } from "c/tsAbcHopeGiftEvents";

// When this page last loaded fresh data in this tab (kept across in-site navigation).
let lastLoadedAt = 0;

/**
 * Campaign detail page (/campaign?name=…), opened from "View more" on the dashboard cards.
 * Shows an open campaign's story, progress, the programs it funds and the causes donors can
 * choose, with a Donate now button. Unknown or closed campaigns get a friendly message.
 */
export default class CampaignDetail extends LightningElement {
  @api currencyLabel = "USD";

  campaignName;
  detail;
  error;
  loaded = false;

  @wire(CurrentPageReference)
  setPage(ref) {
    const name = ref?.state?.name;
    if (name !== this.campaignName) {
      this.campaignName = name;
      this.loaded = !name;
      this.detail = undefined;
      this.error = undefined;
    }
  }

  @wire(getCampaignDetail, { campaignName: "$campaignName" })
  wiredDetail(result) {
    const { data, error } = result;
    // Cached from before a new gift: fetch the current raised amount and gift count.
    if (data && giftsChangedAt() > lastLoadedAt) {
      lastLoadedAt = Date.now();
      refreshApex(result);
    }
    if (data !== undefined || error) {
      this.loaded = true;
    }
    this.detail = data || undefined;
    this.error = error
      ? error.body?.message || "We could not load this campaign."
      : undefined;
  }

  get isLoading() {
    return !this.loaded;
  }
  get notFound() {
    return this.loaded && !this.error && !this.detail;
  }
  get hasDetail() {
    return !!this.detail;
  }
  get card() {
    return this.detail?.card || {};
  }
  get photo() {
    return campaignPhoto(this.card.name, { width: 1400, height: 520 });
  }
  get backHref() {
    return `${basePath || ""}/dashboard#campaigns`;
  }
  get donateHref() {
    return `${basePath || ""}/donate?campaign=${encodeURIComponent(this.card.name || "")}`;
  }
  get raisedDisplay() {
    return this.money(this.card.raised);
  }
  get hasGoal() {
    return Number(this.card.goal) > 0;
  }
  get goalDisplay() {
    return this.money(this.card.goal);
  }
  get pct() {
    const goal = Number(this.card.goal) || 0;
    const raised = Number(this.card.raised) || 0;
    return goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  }
  get pctDisplay() {
    return `${this.pct}% of goal`;
  }
  get barStyle() {
    return `width: ${this.pct}%`;
  }
  get giftsDisplay() {
    const n = this.card.giftCount || 0;
    return n ? `${n} gift${n === 1 ? "" : "s"}` : "Be the first to give";
  }
  get timingDisplay() {
    const d = this.card.daysLeft;
    if (d === null || d === undefined) return "Open-ended";
    return d === 0 ? "Ends today" : `${d} day${d === 1 ? "" : "s"} left`;
  }
  get datesDisplay() {
    const start = formatDate(this.detail?.startDate);
    const end = formatDate(this.card.endDate);
    if (start && end) return `${start} – ${end}`;
    if (end) return `Until ${end}`;
    return start ? `From ${start}` : "";
  }
  get programs() {
    return (this.detail?.programs || []).map((p, i) => ({
      ...p,
      key: `p${i}`,
      href: `${basePath || ""}/program?name=${encodeURIComponent(p.name)}`
    }));
  }
  get hasPrograms() {
    return this.programs.length > 0;
  }
  get causes() {
    return (this.detail?.causes || []).map((c, i) => ({ ...c, key: `c${i}` }));
  }
  get hasCauses() {
    return this.causes.length > 0;
  }

  money(value) {
    const n = Number(value);
    return `${this.currencyLabel} ${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(Number.isFinite(n) ? n : 0)}`;
  }
}

/** Apex Dates arrive as "YYYY-MM-DD"; format in UTC so the day never shifts. */
export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}
