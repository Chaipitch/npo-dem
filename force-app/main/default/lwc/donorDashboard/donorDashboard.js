import { LightningElement, api, wire } from "lwc";
import basePath from "@salesforce/community/basePath";
import getDashboard from "@salesforce/apex/DonorPortalController.getDashboard";

const IMPACT_ICONS = ["👥", "🏠", "🌱", "❤️"];
const IMPACT_TONES = ["tone-blue", "tone-indigo", "tone-green", "tone-red"];
const STORY_ICONS = { "Clean Water": "💧", Education: "📚", Environment: "🌳" };
const JOURNEY_ICONS = ["❤", "💧", "📚", "🌳", "🎁", "⭐"];

export default class DonorDashboard extends LightningElement {
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
    "How are the programs I supported doing this year?;Show my giving history;What is the next milestone?";

  data;
  error;

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

  get isLoading() {
    return !this.data && !this.error;
  }
  get greeting() {
    return this.data ? `Welcome back, ${this.data.firstName}` : "";
  }
  get totalDisplay() {
    return `${this.currencyLabel} ${formatNumber(this.data?.totalContributions || 0)}`;
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
  get impactTiles() {
    return splitList(this.sharedImpact).map((item, i) => {
      const [value, label] = item.split("|");
      return {
        key: `i${i}`,
        value: (value || "").trim(),
        label: (label || "").trim(),
        icon: IMPACT_ICONS[i % IMPACT_ICONS.length],
        className: `impact-tile ${IMPACT_TONES[i % IMPACT_TONES.length]}`
      };
    });
  }
  get storyCards() {
    return splitList(this.stories).map((item, i) => {
      const [tag, title, summary] = item
        .split("|")
        .map((x) => (x || "").trim());
      return {
        key: `s${i}`,
        tag,
        title,
        summary,
        icon: STORY_ICONS[tag] || "✨",
        tagClass: `tag tag-${i % 3}`
      };
    });
  }
  get journey() {
    return (this.data?.journey || []).map((m, i, arr) => ({
      ...m,
      key: `j${i}`,
      icon: JOURNEY_ICONS[i % JOURNEY_ICONS.length],
      dotClass: `journey-dot journey-dot-${i % 4}`,
      showLine: i < arr.length - 1
    }));
  }
  get gifts() {
    return (this.data?.gifts || []).map((g) => ({
      ...g,
      amountDisplay: `${this.currencyLabel} ${formatNumber(g.amount)}`,
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
  get causes() {
    return this.data?.causes || [];
  }
  get donateHref() {
    return `${basePath || ""}${this.donatePath}`;
  }
  get suggestions() {
    return splitList(this.agentSuggestions).map((label, i) => ({
      key: `q${i}`,
      label
    }));
  }

  handleScroll(event) {
    const target = this.template.querySelector(
      `[data-section="${event.currentTarget.dataset.target}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  handleAsk() {
    // Opens the site's Embedded Messaging (Agentforce) window when it is deployed on the page.
    const bootstrap = window.embeddedservice_bootstrap;
    if (bootstrap?.utilAPI?.launchChat) {
      bootstrap.utilAPI.launchChat();
    } else {
      this.agentUnavailable = true;
    }
  }
  agentUnavailable = false;
}

function splitList(value) {
  return String(value || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)
    : "0";
}
