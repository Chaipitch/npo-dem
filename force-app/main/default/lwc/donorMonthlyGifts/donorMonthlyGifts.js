import { LightningElement, api } from "lwc";
import getMonthlyGifts from "@salesforce/apex/DonorPortalController.getMonthlyGifts";
import manageMonthlyGift from "@salesforce/apex/DonorPortalController.manageMonthlyGift";

const PAUSE_MONTHS = [1, 2, 3, 6, 12];
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

/**
 * My Giving → Monthly gifts: the signed-in donor pauses, resumes, changes or cancels their own
 * monthly gifts (D-22). The server checks every gift belongs to the running user.
 * Fires "giftschange" after a change so the dashboard can refresh its counts.
 */
export default class DonorMonthlyGifts extends LightningElement {
  @api currencyLabel = "THB";
  @api donateHref = "/donate";

  gifts = [];
  loaded = false;
  loadError;
  busy = false;
  notice;
  error;
  /** "<giftId>:pause" | "<giftId>:amount" | "<giftId>:cancel" — one open panel at a time */
  openPanel;
  pauseMonths = "1";
  newAmount;

  connectedCallback() {
    this.load();
  }

  async load() {
    try {
      this.gifts = (await getMonthlyGifts()) || [];
      this.loadError = undefined;
    } catch (e) {
      this.loadError = message(e, "We could not load your monthly gifts.");
    }
    this.loaded = true;
  }

  // ------------------------------------------------------------ view model
  get hasGifts() {
    return this.gifts.length > 0;
  }
  get isEmpty() {
    return this.loaded && !this.loadError && this.gifts.length === 0;
  }
  get pauseOptions() {
    return PAUSE_MONTHS.map((m) => ({
      value: String(m),
      label: `${m} month${m === 1 ? "" : "s"}`,
      selected: String(m) === this.pauseMonths
    }));
  }
  get cards() {
    return this.gifts.map((g) => {
      const panel = this.openPanel?.startsWith(`${g.id}:`)
        ? this.openPanel.split(":")[1]
        : "";
      const meta = [
        g.designation,
        g.program ? `${g.program} program` : "",
        g.campaignName
      ].filter(Boolean);
      return {
        id: g.id,
        amountDisplay: g.amount
          ? `${this.currencyLabel} ${formatNumber(g.amount)} / month`
          : "Monthly gift",
        meta: meta.join(" · "),
        isPaused: g.isPaused,
        statusLabel: g.isPaused
          ? `Paused ${formatDate(g.pausedFrom)} – ${g.pausedUntil ? formatDate(g.pausedUntil) : "further notice"}`
          : "Active",
        statusClass: g.isPaused
          ? "status status-paused"
          : "status status-active",
        nextGift: g.nextGiftDate
          ? `Next gift ${formatDate(g.nextGiftDate)}`
          : "",
        showActions: !panel,
        showPause: panel === "pause",
        showAmount: panel === "amount",
        showCancel: panel === "cancel"
      };
    });
  }

  // ------------------------------------------------------------ actions
  openFor(event) {
    const { id, panel } = event.currentTarget.dataset;
    this.openPanel = `${id}:${panel}`;
    this.pauseMonths = "1";
    this.newAmount = undefined;
    this.error = undefined;
    this.notice = undefined;
  }
  closePanel() {
    this.openPanel = undefined;
    this.error = undefined;
  }
  handleMonths(event) {
    this.pauseMonths = event.target.value;
  }
  handleAmount(event) {
    this.newAmount = event.target.value;
  }

  confirmPause(event) {
    this.run(event.currentTarget.dataset.id, "pause", {
      pauseMonths: Number(this.pauseMonths)
    });
  }
  confirmAmount(event) {
    const amount = Number(this.newAmount);
    if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      this.error = `Please enter a monthly amount between ${this.currencyLabel} ${formatNumber(MIN_AMOUNT)} and ${this.currencyLabel} ${formatNumber(MAX_AMOUNT)}.`;
      return;
    }
    this.run(event.currentTarget.dataset.id, "change_amount", {
      newAmount: amount
    });
  }
  confirmCancel(event) {
    this.run(event.currentTarget.dataset.id, "cancel", {});
  }
  resume(event) {
    this.openPanel = undefined;
    this.run(event.currentTarget.dataset.id, "resume", {});
  }

  async run(giftId, operation, extra) {
    this.busy = true;
    this.error = undefined;
    this.notice = undefined;
    try {
      const res = await manageMonthlyGift({
        giftId,
        operation,
        pauseMonths: extra.pauseMonths ?? null,
        newAmount: extra.newAmount ?? null
      });
      this.gifts = res.gifts || [];
      this.notice = res.message;
      this.openPanel = undefined;
      this.dispatchEvent(new CustomEvent("giftschange"));
    } catch (e) {
      this.error = message(e, "We could not make this change right now.");
    }
    this.busy = false;
  }
}

function message(e, fallback) {
  return e?.body?.message || fallback;
}

export function formatNumber(n) {
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Apex Dates arrive as "YYYY-MM-DD"; format in UTC so the day never shifts. */
export function formatDate(d) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(`${d}T00:00:00Z`));
}
