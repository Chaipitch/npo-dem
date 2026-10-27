import { LightningElement, api, wire } from "lwc";
import basePath from "@salesforce/community/basePath";
import getPrograms from "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms";
import { formatNumber, deliveryLabel } from "c/tsAbcHopeProgramDetail";

/**
 * Public "Our Work" page (D-26): ABC Hope's active programs, each with the open campaigns and causes
 * that fund it (Program ← GiftDesignation.NGOTV_Program__c ← campaign default designations, D-21).
 * Each card shows live figures (raised, people served, the largest delivery) and links to /program (D-33).
 */
export default class AbcHopeOurWork extends LightningElement {
  @api heading = "Our Work";
  @api intro =
    "Every gift funds one of our programs. Choose a campaign below to support the work that matters to you.";

  programs = [];
  loaded = false;
  error;

  @wire(getPrograms)
  wiredPrograms({ data, error }) {
    if (data) {
      this.programs = data;
      this.error = undefined;
      this.loaded = true;
    } else if (error) {
      this.error = "We could not load our programs right now.";
      this.loaded = true;
    }
  }

  get isLoading() {
    return !this.loaded;
  }
  get isEmpty() {
    return this.loaded && !this.error && this.programs.length === 0;
  }
  get cards() {
    const base = basePath || "";
    return this.programs.map((p, i) => ({
      key: `p${i}`,
      name: p.name,
      href: `${base}/program?name=${encodeURIComponent(p.name)}`,
      figures: figures(p),
      summary: p.summary || "",
      causes: (p.causes || []).map((c) => ({
        key: `${p.name}-${c}`,
        label: c
      })),
      campaigns: (p.campaigns || []).map((c) => ({
        key: `${p.name}-c-${c}`,
        label: c,
        href: `${base}/donate?campaign=${encodeURIComponent(c)}`
      })),
      hasCampaigns: (p.campaigns || []).length > 0
    }));
  }
}

/** Raised, people served and the largest delivery, leaving out what is zero. */
function figures(p) {
  const list = [];
  if (Number(p.raised) > 0) {
    list.push({ value: `USD ${formatNumber(p.raised)}`, label: "raised" });
  }
  if (Number(p.peopleServed) > 0) {
    list.push({
      value: formatNumber(p.peopleServed),
      label: p.peopleServed === 1 ? "person served" : "people served"
    });
  }
  const top = (p.deliveries || [])[0];
  if (top) {
    list.push({ value: formatNumber(top.quantity), label: deliveryLabel(top) });
  }
  return list.map((f, i) => ({ ...f, key: `${p.name}-f${i}` }));
}
