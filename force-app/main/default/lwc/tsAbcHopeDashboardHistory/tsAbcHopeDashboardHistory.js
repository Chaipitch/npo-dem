import { LightningElement, api, wire } from "lwc";
import { refreshApex } from "@salesforce/apex";
import { giftsChangedAt, GIFTS_CHANGED } from "c/tsAbcHopeGiftEvents";
import getGivingPage from "@salesforce/apex/TSAbcHopeDonorPortalController.getGivingPage";
import { money, formatDate } from "c/tsAbcHopeDashboardUtils";

// When this table last loaded fresh data in this tab (kept across in-site navigation).
let lastLoadedAt = 0;

/** My Giving → Giving History: one page of 5 gifts at a time from the server (D-49, D-51). */
export default class DashboardHistory extends LightningElement {
  @api currencyLabel = "USD";

  page = 1;
  givingPage;
  givingPageError;
  _wired;

  @wire(getGivingPage, { page: "$page" })
  wiredGivingPage(result) {
    this._wired = result;
    if (result.data && giftsChangedAt() > lastLoadedAt) {
      // Cached from before a donation or gift change: load it again once.
      this.refresh();
    }
    if (result.data) {
      this.givingPage = result.data;
      this.givingPageError = undefined;
    } else if (result.error) {
      this.givingPageError =
        result.error.body?.message || "We could not load your giving history.";
    }
  }

  connectedCallback() {
    this._onGiftsChanged = () => this.refresh();
    window.addEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }
  disconnectedCallback() {
    window.removeEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }
  refresh() {
    lastLoadedAt = Date.now();
    if (this._wired) refreshApex(this._wired);
  }

  get gifts() {
    return (this.givingPage?.gifts || []).map((g) => ({
      ...g,
      amountDisplay: money(g.amount, this.currencyLabel),
      dateDisplay: formatDate(g.giftDate),
      statusClass: `status status-${(g.status || "").toLowerCase()}`
    }));
  }
  get hasGifts() {
    return this.gifts.length > 0;
  }
  get historyLoading() {
    return !this.givingPage && !this.givingPageError;
  }
  get total() {
    return this.givingPage?.total || 0;
  }
  get pageSize() {
    return this.givingPage?.pageSize || 5;
  }
  get pageCount() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
  /** The page the server returned (it keeps the page in range, e.g. after a gift is cancelled). */
  get currentPage() {
    return this.givingPage?.page || 1;
  }
  get showPager() {
    return this.total > this.pageSize;
  }
  /** "Showing 6–10 of 37 gifts". */
  get pageSummary() {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(start + this.gifts.length - 1, this.total);
    return `Showing ${start}–${end} of ${this.total} gifts`;
  }
  get pageLabel() {
    return `Page ${this.currentPage} of ${this.pageCount}`;
  }
  get isFirstPage() {
    return this.currentPage <= 1;
  }
  get isLastPage() {
    return this.currentPage >= this.pageCount;
  }
  previousPage() {
    this.page = this.currentPage - 1;
  }
  nextPage() {
    this.page = this.currentPage + 1;
  }
}
