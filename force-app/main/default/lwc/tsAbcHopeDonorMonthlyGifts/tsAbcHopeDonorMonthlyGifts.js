import { LightningElement, api } from "lwc";
import getMonthlyGifts from "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts";
import manageMonthlyGift from "@salesforce/apex/TSAbcHopeDonorPortalController.manageMonthlyGift";
import { markGiftsChanged, GIFTS_CHANGED } from "c/tsAbcHopeGiftEvents";

const PAUSE_MONTHS = [1, 2, 3, 6, 12];
// Schedule period → type and unit; anything else (e.g. Custom) reads as Monthly (D-24).
const PERIODS = {
  Weekly: { type: "Weekly", unit: "week" },
  Monthly: { type: "Monthly", unit: "month" },
  Yearly: { type: "Yearly", unit: "year" }
};
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;

/**
 * My Giving → Recurring gifts: the signed-in donor pauses, resumes, changes or cancels their own
 * weekly, monthly or yearly gifts (D-22, D-24). The server checks every gift belongs to the running user.
 * Fires "giftschange" after a change so the dashboard can refresh its counts.
 */
/** Recurring gift cards shown before the list scrolls. */
const VISIBLE_CARDS = 2;

export default class DonorMonthlyGifts extends LightningElement {
  @api currencyLabel = "USD";
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
    // A gift changed elsewhere on this page (e.g. by the assistant): reload the cards.
    this._onGiftsChanged = () => {
      if (!this.busy) this.load(); // skip the echo of this component's own change
    };
    window.addEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }
  disconnectedCallback() {
    window.removeEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }

  async load() {
    try {
      this.gifts = (await getMonthlyGifts()) || [];
      this.loadError = undefined;
    } catch (e) {
      this.loadError = message(e, "We could not load your recurring gifts.");
    }
    this.loaded = true;
  }

  // ------------------------------------------------------------ view model
  get hasGifts() {
    return this.gifts.length > 0;
  }
  /** More than two gifts: the list scrolls, showing two cards at a time (D-49). */
  get scrolls() {
    return this.gifts.length > VISIBLE_CARDS;
  }
  get listClass() {
    return this.scrolls ? "gift-list gift-list_scroll" : "gift-list";
  }
  get listTabIndex() {
    return this.scrolls ? "0" : null;
  }

  /** Size the scrolling list to the first two cards as they are now (cards grow when a panel opens). */
  renderedCallback() {
    const list = this.refs?.giftList;
    if (!list) return;
    const cards = list.querySelectorAll(".gift");
    if (!this.scrolls || cards.length <= VISIBLE_CARDS) {
      list.style.maxHeight = "";
      return;
    }
    const top = list.getBoundingClientRect().top;
    const bottom = cards[VISIBLE_CARDS - 1].getBoundingClientRect().bottom;
    if (bottom > top) {
      list.style.maxHeight = `${Math.ceil(bottom - top) + 2}px`;
    }
  }
  get isEmpty() {
    return this.loaded && !this.loadError && this.gifts.length === 0;
  }
  /** Text before the link; kept in JS so the space before the link survives template formatting. */
  get scheduleNoteLead() {
    return "Want a different schedule (weekly, monthly or yearly)? Cancel the gift and ";
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
      const period = PERIODS[g.period] || PERIODS.Monthly;
      const meta = [
        g.designation,
        g.program ? `${g.program} program` : "",
        g.campaignName
      ].filter(Boolean);
      return {
        id: g.id,
        typeLabel: `Recurring (${period.type})`,
        amountDisplay: g.amount
          ? `${this.currencyLabel} ${formatNumber(g.amount)} / ${period.unit}`
          : "Recurring gift",
        amountLabel: `New amount per ${period.unit} (${this.currencyLabel})`,
        periodWord: period.type.toLowerCase(),
        meta: meta.join(" · "),
        isPaused: g.isPaused,
        cardClass: g.isPaused ? "gift gift_paused" : "gift",
        statusLabel: g.isPaused
          ? g.pausedUntil
            ? `Paused until ${formatDate(g.pausedUntil)}`
            : "Paused"
          : "Active",
        pauseNote: g.isPaused
          ? `No gifts from ${formatDate(g.pausedFrom)}${g.pausedUntil ? ` to ${formatDate(g.pausedUntil)}` : ""}. Resume any time.`
          : "",
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
    // Keep the card whose panel just opened in view inside the scrolling list.
    const card = event.currentTarget.closest(".gift");
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() =>
      card?.scrollIntoView?.({ block: "nearest", behavior: "smooth" })
    );
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
      this.error = `Please enter an amount between ${this.currencyLabel} ${formatNumber(MIN_AMOUNT)} and ${this.currencyLabel} ${formatNumber(MAX_AMOUNT)}.`;
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
      markGiftsChanged();
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
