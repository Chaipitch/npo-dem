import { LightningElement, api, wire } from "lwc";
import basePath from "@salesforce/community/basePath";
import getDashboard from "@salesforce/apex/DonorPortalController.getDashboard";

const IMPACT_STYLE = [
  { icon: "users", tone: "tone-blue" },
  { icon: "home", tone: "tone-indigo" },
  { icon: "sprout", tone: "tone-green" },
  { icon: "heart-fill", tone: "tone-red" }
];
const STORY_ART = ["water", "school", "sprout"];
const JOURNEY_TONES = ["jt-red", "jt-green", "jt-amber", "jt-purple"];
const JOURNEY_ICONS = ["heart", "sprout", "book", "gift"];

export default class DonorDashboard extends LightningElement {
  /** "home" = donor home (mockup #1); "giving" = KPIs + full giving history */
  @api view = "home";
  @api currencyLabel = "THB";
  @api bannerTitle = "See What We’ve Achieved Together";
  @api bannerSubtitle = "Your support is part of something bigger.";
  /** "value|label" pairs separated by ";" */
  @api sharedImpact =
    "8,400|People Reached;12|Communities;6|Programs;125|Volunteers Engaged";
  /** "tag|title|summary" triples separated by ";" */
  @api stories =
    "Clean Water|Clean Water Brings New Opportunities|See how improved access to clean water is changing lives in rural communities.;" +
    "Education|More Girls in School|Your support helps provide scholarships and learning resources for girls in underserved areas.;" +
    "Environment|Greener Communities for Generations|Tree planting and conservation efforts are creating healthier communities.";
  @api donatePath = "/donate";
  @api agentSuggestions =
    "Explore my causes;View giving history;Show next milestones";

  data;
  error;
  _scrolledTo;

  @wire(getDashboard)
  wiredDashboard({ data, error }) {
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
  }
  disconnectedCallback() {
    window.removeEventListener("hashchange", this._onHash);
  }
  renderedCallback() {
    this.scrollToHash();
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

  // ------------------------------------------------------------ view state
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

  // ------------------------------------------------------------ KPIs
  get totalDisplay() {
    return this.money(this.data?.totalContributions || 0);
  }
  get causesDisplay() {
    return this.data?.causesSupported ?? 0;
  }
  get sinceDisplay() {
    return this.data ? `Since ${this.data.supporterSince}` : "";
  }
  get monthlyNote() {
    const n = this.data?.activeMonthlyGifts || 0;
    return n > 0 ? `${n} active monthly gift${n === 1 ? "" : "s"}` : "";
  }
  get givingHref() {
    return `${basePath || ""}/my-giving`;
  }
  get causesHref() {
    return `${basePath || ""}/dashboard#causes`;
  }
  get journeyHref() {
    return `${basePath || ""}/dashboard#journey`;
  }
  get donateHref() {
    return `${basePath || ""}${this.donatePath}`;
  }

  // ------------------------------------------------------------ content
  get impactTiles() {
    return splitList(this.sharedImpact).map((item, i) => {
      const [value, label] = item.split("|").map((x) => (x || "").trim());
      const style = IMPACT_STYLE[i % IMPACT_STYLE.length];
      return {
        key: `i${i}`,
        value,
        label,
        icon: style.icon,
        className: `impact-tile ${style.tone}`
      };
    });
  }
  get storyCards() {
    return splitList(this.stories).map((item, i) => {
      const [tag, title, summary] = item
        .split("|")
        .map((x) => (x || "").trim());
      const art = STORY_ART[i % STORY_ART.length];
      return {
        key: `s${i}`,
        tag,
        title,
        summary,
        tagClass: `tag tag-${i % 3}`,
        isWater: art === "water",
        isSchool: art === "school",
        isSprout: art === "sprout"
      };
    });
  }
  get journey() {
    const items = this.data?.journey || [];
    return items.map((m, i) => ({
      ...m,
      key: `j${i}`,
      icon: JOURNEY_ICONS[i % JOURNEY_ICONS.length],
      dotClass: `journey-dot ${JOURNEY_TONES[i % JOURNEY_TONES.length]}`,
      showLine: i < items.length - 1
    }));
  }
  get causes() {
    return (this.data?.causes || []).map((c, i) => ({
      key: `c${i}`,
      label: c
    }));
  }
  get hasCauses() {
    return this.causes.length > 0;
  }
  get gifts() {
    return (this.data?.gifts || []).map((g) => ({
      ...g,
      amountDisplay: this.money(g.amount),
      dateDisplay: g.giftDate
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
            new Date(g.giftDate)
          )
        : "",
      statusClass: `status status-${(g.status || "").toLowerCase()}`
    }));
  }
  get hasGifts() {
    return this.gifts.length > 0;
  }

  // ------------------------------------------------------------ agent panel
  get initial() {
    return (this.data?.firstName || "D").charAt(0).toUpperCase();
  }
  get agentIntro() {
    const n = this.data?.causesSupported || 0;
    return n
      ? `You’ve supported ${n} cause${n === 1 ? "" : "s"}. Here’s where your giving went:`
      : "You haven’t made a gift yet — here’s how you can start:";
  }
  get agentCauses() {
    const totals = new Map();
    for (const g of this.data?.gifts || []) {
      const names = (g.designations || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const share = names.length ? (g.amount || 0) / names.length : 0;
      for (const n of names) totals.set(n, (totals.get(n) || 0) + share);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, amount], i) => ({
        key: `a${i}`,
        label,
        amount: this.money(amount),
        artClass: `agent-art art-${i % 3}`
      }));
  }
  get suggestions() {
    return splitList(this.agentSuggestions).map((label, i) => ({
      key: `q${i}`,
      label
    }));
  }
  agentUnavailable = false;

  handleAsk() {
    const bootstrap = window.embeddedservice_bootstrap;
    if (bootstrap?.utilAPI?.launchChat) {
      bootstrap.utilAPI.launchChat();
    } else {
      this.agentUnavailable = true;
    }
  }

  money(value) {
    const n = Number(value);
    return `${this.currencyLabel} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
  }
}

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
