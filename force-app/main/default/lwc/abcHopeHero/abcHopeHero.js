import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import isGuest from "@salesforce/user/isGuest";
import getCampaigns from "@salesforce/apex/DonationIntakeController.getCampaigns";
import { campaignPhoto } from "c/abcHopeCampaignPhotos";

const BENEFIT_ICONS = ["cap", "community", "heart"];
const MAX_BODY = 150;

/**
 * Home "Discover" hero: a carousel of open campaigns. The first slide is the featured campaign set in
 * Experience Builder (headline, body, photo); the rest are the other open campaigns from getCampaigns()
 * (same list as the dashboard cards). Advances every intervalSeconds; arrows, dots and a pause button
 * let visitors move or stop it, and it pauses while hovered or focused.
 */
export default class AbcHopeHero extends LightningElement {
  @api featuredCampaign = "Christmas Giving 2026";
  @api headlineStart = "Make Christmas";
  @api headlineHighlight = "Brighter";
  @api body =
    "Help give children the tools to learn, grow and build a brighter tomorrow.";
  @api ctaLabel = "Donate Now";
  @api ctaPath = "/donate";
  @api backgroundImageUrl =
    "https://images.unsplash.com/photo-1606916693216-69bd7e1cf2fa?auto=format&fit=crop&w=2000&q=80";
  @api imageCredit = "Photo: Christian Bowen / Unsplash";
  @api benefits =
    "More Learning Opportunities,Stronger Communities,Brighter Futures";
  @api dashboardPath = "/dashboard";
  @api intervalSeconds = 10;

  sourceCode;
  campaigns = [];
  index = 0;
  paused = false; // pause button
  hovering = false; // hover or keyboard focus inside

  @wire(CurrentPageReference)
  setPageRef(pageRef) {
    this.sourceCode = pageRef?.state?.src;
  }

  @wire(getCampaigns)
  wiredCampaigns({ data }) {
    if (data) {
      this.campaigns = data;
      if (this.index >= this.slideData.length) this.index = 0;
    }
  }

  connectedCallback() {
    this.startTimer();
  }
  disconnectedCallback() {
    this.stopTimer();
  }

  // ------------------------------------------------------------ slides
  donateHref(campaignName) {
    const path = (this.ctaPath || "/donate").startsWith("/")
      ? this.ctaPath
      : `/${this.ctaPath}`;
    const params = [];
    if (campaignName)
      params.push(`campaign=${encodeURIComponent(campaignName)}`);
    if (this.sourceCode)
      params.push(`src=${encodeURIComponent(this.sourceCode)}`);
    return `${basePath || ""}${path}${params.length ? `?${params.join("&")}` : ""}`;
  }

  get slideData() {
    const featured = {
      key: "featured",
      eyebrow: this.featuredCampaign,
      headline: this.headlineStart,
      highlight: this.headlineHighlight,
      body: this.body,
      photo: this.backgroundImageUrl
        ? { url: this.backgroundImageUrl, credit: this.imageCredit }
        : campaignPhoto(this.featuredCampaign, { width: 2000 }),
      alt: "Two children in Christmas pyjamas sitting by a decorated tree",
      href: this.donateHref(null),
      featured: true
    };
    const others = (this.campaigns || [])
      .filter((c) => c.name !== this.featuredCampaign)
      .map((c) => ({
        key: c.id,
        eyebrow:
          c.daysLeft != null ? `${c.daysLeft} days left` : "Open campaign",
        headline: c.name,
        highlight: "",
        body: abbreviate(c.description, MAX_BODY),
        photo: campaignPhoto(c.name, { width: 2000 }),
        alt: "",
        href: this.donateHref(c.name),
        featured: false
      }));
    return [featured, ...others];
  }

  get slides() {
    const all = this.slideData;
    return all.map((s, i) => {
      const active = i === this.index;
      return {
        ...s,
        active,
        ariaHidden: active ? "false" : "true",
        tabIndex: active ? "0" : "-1",
        label: `${i + 1} of ${all.length}`,
        className: `slide${s.featured ? " slide_featured" : ""}${active ? " slide_active" : ""}`,
        dotClass: active ? "dot dot_active" : "dot",
        dotLabel: `Show ${s.headline}${s.highlight ? ` ${s.highlight}` : ""}`,
        index: i
      };
    });
  }
  get hasMany() {
    return this.slideData.length > 1;
  }
  get pauseLabel() {
    return this.paused ? "Play slideshow" : "Pause slideshow";
  }
  get pauseIcon() {
    return this.paused ? "▶" : "❚❚";
  }

  // ------------------------------------------------------------ controls
  show(i) {
    const n = this.slideData.length;
    this.index = ((i % n) + n) % n;
  }
  next() {
    this.show(this.index + 1);
  }
  handlePrev() {
    this.show(this.index - 1);
    this.startTimer(); // a manual move restarts the 10 seconds
  }
  handleNext() {
    this.next();
    this.startTimer();
  }
  handleDot(event) {
    this.show(Number(event.currentTarget.dataset.index));
    this.startTimer();
  }
  handlePause() {
    this.paused = !this.paused;
  }
  handleEnter() {
    this.hovering = true;
  }
  handleLeave() {
    this.hovering = false;
  }

  startTimer() {
    this.stopTimer();
    const ms = Math.max(3, Number(this.intervalSeconds) || 10) * 1000;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._timer = setInterval(() => {
      if (!this.paused && !this.hovering && this.hasMany) this.next();
    }, ms);
  }
  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = undefined;
  }

  // ------------------------------------------------------------ static parts
  get isSignedIn() {
    return !isGuest;
  }
  get dashboardHref() {
    return `${basePath || ""}${this.dashboardPath}`;
  }
  get benefitItems() {
    return String(this.benefits || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .map((label, i) => ({
        key: `b${i}`,
        label,
        icon: BENEFIT_ICONS[i % BENEFIT_ICONS.length]
      }));
  }
}

function abbreviate(text, max) {
  const t = (text || "").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
