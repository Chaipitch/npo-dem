import { LightningElement, api, wire } from "lwc";
import { refreshApex } from "@salesforce/apex";
import { giftsChangedAt, GIFTS_CHANGED } from "c/tsAbcHopeGiftEvents";
import getDashboard from "@salesforce/apex/TSAbcHopeDonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";
import { sitePath } from "c/tsAbcHopeDashboardUtils";

// When the dashboard last loaded fresh data in this tab (kept across in-site navigation).
let lastLoadedAt = 0;

/**
 * Signed-in donor dashboard (view=home) and My Giving (view=giving). Loads the dashboard summary and the open
 * campaigns, lays out the page and passes the data to its sections (D-51): c-ts-abc-hope-dashboard-banner, -kpis,
 * -campaigns, -impact, -stories, -causes, -journey, -history and -assistant, plus the recurring gifts
 * (c-ts-abc-hope-donor-monthly-gifts). Reloads after a gift changes and scrolls to the #section in the URL.
 */
export default class DonorDashboard extends LightningElement {
  /** "home" = donor home (mockup #1); "giving" = KPIs + recurring gifts + giving history */
  @api view = "home";
  @api currencyLabel = "USD";
  @api bannerTitle = "See What We’ve Achieved Together";
  @api bannerSubtitle = "Your support is part of something bigger.";
  /**
   * "value|label" pairs separated by ";". Live placeholders: {programs} (active Programs) and {peopleReached},
   * {communities}, {volunteers}: the sums of People Reached, Communities and Volunteers Engaged on active
   * Programs (D-34). Anything else is shown as typed.
   */
  @api sharedImpact =
    "{peopleReached}|People Reached;{communities}|Communities;{programs}|Programs;{volunteers}|Volunteers Engaged";
  /** "tag|title|summary|program" entries separated by ";"; the photo is the program's Image URL (D-57). */
  @api stories =
    "Clean Water|Clean Water Brings New Opportunities|See how improved access to clean water is changing lives in rural communities.|Clean Water;" +
    "Education|More Girls in School|Your support helps provide scholarships and learning resources for girls in underserved areas.|Education Access;" +
    "Environment|Greener Communities for Generations|Tree planting and conservation efforts are creating healthier communities.|Green Communities";
  @api donatePath = "/donate";
  @api bannerImageUrl =
    "https://images.unsplash.com/photo-1761415451904-0a0a2c630ea9?auto=format&fit=crop&w=2000&q=80";
  @api bannerImageCredit = "Photo: Ben Kupke / Unsplash";
  @api agentSuggestions =
    "Explore my causes;View giving history;Show next milestones";
  /** "Campaign name|image URL|credit" entries separated by ";" — other campaigns get a themed Unsplash photo */
  @api campaignImages =
    "Christmas Giving 2026|https://images.unsplash.com/photo-1606916693216-69bd7e1cf2fa?auto=format&fit=crop&w=900&q=75|Photo: Christian Bowen / Unsplash";

  data;
  error;
  campaigns = [];
  _scrolledTo;

  _wiredCampaigns;
  @wire(getCampaigns)
  wiredCampaigns(result) {
    this._wiredCampaigns = result;
    if (result.data) {
      this.campaigns = result.data;
    }
  }

  _wiredDashboard;
  @wire(getDashboard)
  wiredDashboard(result) {
    this._wiredDashboard = result;
    const { data, error } = result;
    // Cached from before a donation or gift change (possibly on another page): reload everything once.
    if (data && giftsChangedAt() > lastLoadedAt) {
      this.refreshData();
    }
    if (data) {
      this.data = data;
      this.error = undefined;
    } else if (error) {
      this.error =
        error.body?.message || "We could not load your giving summary.";
      this.data = undefined;
    }
  }

  connectedCallback() {
    this._onHash = () => {
      this._scrolledTo = undefined;
      this.scrollToHash();
    };
    window.addEventListener("hashchange", this._onHash);
    this._onGiftsChanged = () => this.refreshData();
    window.addEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }
  disconnectedCallback() {
    window.removeEventListener("hashchange", this._onHash);
    window.removeEventListener(GIFTS_CHANGED, this._onGiftsChanged);
  }
  renderedCallback() {
    this.scrollToHash();
  }

  /** Reload the summary and the campaign cards (both are cacheable Apex); the history reloads itself. */
  refreshData() {
    lastLoadedAt = Date.now();
    if (this._wiredDashboard) refreshApex(this._wiredDashboard);
    if (this._wiredCampaigns) refreshApex(this._wiredCampaigns);
  }
  handleGiftsChange() {
    this.refreshData();
  }
  scrollToHash() {
    const hash = (window.location.hash || "").replace("#", "");
    if (!hash || !this.data || this._scrolledTo === hash) return;
    const target = this.template.querySelector(`[data-section="${hash}"]`);
    if (target) {
      this._scrolledTo = hash;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  get isHome() {
    return this.view !== "giving";
  }
  get isGiving() {
    return this.view === "giving";
  }
  get isLoading() {
    return !this.data && !this.error;
  }
  get title() {
    return this.isGiving ? "My Giving" : this.bannerTitle;
  }
  get subtitle() {
    return this.isGiving
      ? "Every gift you’ve made, where it went, and its status."
      : this.bannerSubtitle;
  }
  get hasCampaigns() {
    return this.campaigns.length > 0;
  }
  get causes() {
    return this.data?.causes || [];
  }
  get journeyYears() {
    return this.data?.journeyYears || [];
  }
  get donateHref() {
    return sitePath(this.donatePath);
  }
}
