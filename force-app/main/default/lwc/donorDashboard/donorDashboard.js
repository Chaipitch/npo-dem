import { LightningElement, api, wire } from "lwc";
import { refreshApex } from "@salesforce/apex";
import basePath from "@salesforce/community/basePath";
import getDashboard from "@salesforce/apex/DonorPortalController.getDashboard";
import getCampaigns from "@salesforce/apex/DonationIntakeController.getCampaigns";
import askAgent from "@salesforce/apex/DonorAgentController.ask";

const IMPACT_STYLE = [
  { icon: "users", tone: "tone-blue" },
  { icon: "home", tone: "tone-indigo" },
  { icon: "sprout", tone: "tone-green" },
  { icon: "heart-fill", tone: "tone-red" }
];
const STORY_ART = ["water", "school", "sprout"];

// Free Unsplash photos (Unsplash License) used when no image is configured for a campaign or story.
const unsplash = (id, w) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
const CAMPAIGN_PHOTOS = {
  water: {
    url: unsplash("photo-1740741705746-74e6f9b93b4f", 900),
    credit: "Photo: Lisa Marie Theck / Unsplash"
  },
  school: {
    url: unsplash("photo-1573894998033-c0cef4ed722b", 900),
    credit: "Photo: Yogendra Singh / Unsplash"
  },
  sprout: {
    url: unsplash("photo-1777150895644-2ca253ee1c93", 900),
    credit: "Photo: Hammilton Ojijo / Unsplash"
  },
  gift: {
    url: unsplash("photo-1488521787991-ed7bbaae773c", 900),
    credit: "Photo: Larm Rmah / Unsplash"
  }
};
const STORY_PHOTOS = {
  water: {
    url: unsplash("photo-1760873059715-7c7cfbe2a2c6", 600),
    credit: "Photo: Andrew Itaga / Unsplash"
  },
  school: {
    url: unsplash("photo-1542810634-71277d95dcbb", 600),
    credit: "Photo: Yannis H / Unsplash"
  },
  sprout: {
    url: unsplash("photo-1779085031158-a2519daf9747", 600),
    credit: "Photo: Elly M / Unsplash"
  }
};
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

  @wire(getCampaigns)
  wiredCampaigns({ data }) {
    if (data) {
      this.campaigns = data;
    }
  }
  _scrolledTo;

  _wiredDashboard;

  @wire(getDashboard)
  wiredDashboard(result) {
    this._wiredDashboard = result;
    const { data, error } = result;
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
    this.scrollChatToEnd();
  }
  /** Keep the newest chat message in view inside the panel's scroll area. */
  scrollChatToEnd() {
    const count = this.chatMessages.length + (this.chatBusy ? 1 : 0);
    if (count === this._chatScrolledCount) return;
    this._chatScrolledCount = count;
    const body = this.template.querySelector('[data-id="agent-body"]');
    if (body && count > 0) body.scrollTop = body.scrollHeight;
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
    const p = this.data?.pausedMonthlyGifts || 0;
    const parts = [];
    if (n > 0) parts.push(`${n} active monthly gift${n === 1 ? "" : "s"}`);
    if (p > 0) {
      const until = this.data.pausedUntil
        ? ` until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${this.data.pausedUntil}T00:00:00Z`))}`
        : "";
      parts.push(`${p} paused${until}`);
    }
    return parts.join(" · ");
  }
  get manageMonthlyHref() {
    return `${basePath || ""}/my-giving#monthly`;
  }
  handleGiftsChange() {
    refreshApex(this._wiredDashboard);
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
        imageUrl: STORY_PHOTOS[art].url,
        imageCredit: STORY_PHOTOS[art].credit
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

  // ------------------------------------------------------------ campaigns
  get hasCampaigns() {
    return this.campaigns.length > 0;
  }
  get campaignCards() {
    const images = new Map(
      splitList(this.campaignImages).map((entry) => {
        const [name, url, credit] = entry
          .split("|")
          .map((x) => (x || "").trim());
        return [name, { url, credit: credit || "Photo: Unsplash" }];
      })
    );
    const base = basePath || "";
    return this.campaigns.map((c, i) => {
      const goal = Number(c.goal) || 0;
      const raised = Number(c.raised) || 0;
      const pct =
        goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
      const name = (c.name || "").toLowerCase();
      const art = /water/.test(name)
        ? "water"
        : /school|educat|scholar|girl/.test(name)
          ? "school"
          : /tree|green|environment|plant/.test(name)
            ? "sprout"
            : "gift";
      let timing = "";
      if (c.daysLeft !== null && c.daysLeft !== undefined) {
        timing =
          c.daysLeft === 0
            ? "Ends today"
            : `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`;
      }
      return {
        key: c.id || `c${i}`,
        name: c.name,
        description: c.description,
        href: `${base}/donate?campaign=${encodeURIComponent(c.name)}`,
        imageUrl: (images.get(c.name) || CAMPAIGN_PHOTOS[art]).url,
        imageCredit: (images.get(c.name) || CAMPAIGN_PHOTOS[art]).credit,
        raisedDisplay: this.money(raised),
        goalDisplay: goal > 0 ? this.money(goal) : "",
        hasGoal: goal > 0,
        barStyle: `width: ${pct}%`,
        pctDisplay: `${pct}%`,
        giftsDisplay: c.giftCount
          ? `${c.giftCount} gift${c.giftCount === 1 ? "" : "s"}`
          : "Be the first to give",
        timing,
        programsDisplay: (c.programs || []).join(", "),
        chips: (c.designations || []).map((d, j) => ({
          key: `d${j}`,
          label: d
        }))
      };
    });
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
  // ------------------------------------------------------------ inline agent chat
  // Personal questions are answered here from the dashboard data (the agent cannot verify
  // the donor from this panel yet, D-23); everything else goes to the Donor Assistant.
  chatMessages = [];
  chatDraft = "";
  chatBusy = false;
  chatSessionId;
  _chatSeq = 0;

  get chatHasMessages() {
    return this.chatMessages.length > 0;
  }
  get chatSendDisabled() {
    return this.chatBusy || !this.chatDraft.trim();
  }
  handleChatInput(event) {
    this.chatDraft = event.target.value;
  }
  handleChatKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.sendChat(this.chatDraft);
    }
  }
  handleChatSend() {
    this.sendChat(this.chatDraft);
  }
  handleSuggestion(event) {
    this.sendChat(event.currentTarget.dataset.text);
  }
  addChat(role, text, link) {
    this._chatSeq += 1;
    this.chatMessages = [
      ...this.chatMessages,
      {
        key: `m${this._chatSeq}`,
        text,
        link,
        isUser: role === "user",
        rowClass: role === "user" ? "msg msg_user" : "msg msg_agent",
        bubbleClass:
          role === "user"
            ? "bubble"
            : role === "error"
              ? "bubble bubble_agent bubble_error"
              : "bubble bubble_agent"
      }
    ];
  }
  async sendChat(raw) {
    const text = (raw || "").trim();
    if (!text || this.chatBusy) return;
    this.addChat("user", text);
    this.chatDraft = "";
    const local = this.localAnswer(text);
    if (local) {
      this.addChat("agent", local.text, local.link);
      return;
    }
    this.chatBusy = true;
    try {
      const reply = await askAgent({
        message: text,
        sessionId: this.chatSessionId || null
      });
      if (reply.sessionId) this.chatSessionId = reply.sessionId;
      this.addChat(reply.error ? "error" : "agent", reply.error || reply.text);
    } catch {
      this.addChat("error", "The assistant could not answer right now.");
    }
    this.chatBusy = false;
  }

  /** Answers about the donor's own giving, from the dashboard data; null = ask the agent. */
  localAnswer(raw) {
    const d = this.data;
    if (!d) return null;
    const q = raw.toLowerCase();
    const base = basePath || "";
    if (/monthly|recurring|pause|resume|cancel/.test(q)) {
      return {
        text: this.monthlyNote
          ? `You have ${this.monthlyNote}. You can pause, resume, change or cancel them on My Giving.`
          : "You don’t have a monthly gift at the moment. You can start one from any campaign.",
        link: this.monthlyNote
          ? { href: `${base}/my-giving#monthly`, label: "Manage monthly gifts" }
          : { href: this.donateHref, label: "Give monthly" }
      };
    }
    if (/history|recent gifts?|past gifts?|last gifts?|receipt/.test(q)) {
      const recent = (d.gifts || []).slice(0, 3).map((g) => {
        const cause = g.designations ? ` to ${g.designations}` : "";
        return `• ${this.formatGiftDate(g.giftDate)}: ${this.money(g.amount)}${cause}`;
      });
      return {
        text: recent.length
          ? `Your most recent gifts:\n${recent.join("\n")}`
          : "You haven’t made a gift yet.",
        link: { href: `${base}/my-giving`, label: "See all my giving" }
      };
    }
    if (/milestone|journey|next step/.test(q)) {
      const steps = (d.journey || []).map((m) => `• ${m.year} — ${m.label}`);
      return {
        text: steps.length
          ? `Your impact journey so far:\n${steps.join("\n")}\nYour next milestone is your next gift.`
          : "Your impact journey starts with your first gift.",
        link: { href: this.journeyHref, label: "View my journey" }
      };
    }
    if (
      /\b(cause|causes|supported|programs? i)\b|where .*(giving|gift|money)/.test(
        q
      )
    ) {
      const top = this.agentCauses.map(
        (c) => `• ${c.label} — you gave ${c.amount}`
      );
      return {
        text: top.length
          ? `${this.agentIntro}\n${top.join("\n")}`
          : "You haven’t supported a cause yet.",
        link: { href: this.causesHref, label: "Explore my causes" }
      };
    }
    if (
      /how much|total|i('ve| have) (given|donated)|my (giving|gifts|donations)/.test(
        q
      )
    ) {
      return {
        text: `You’ve given ${this.totalDisplay} in total since ${d.supporterSince}, supporting ${d.causesSupported} cause${d.causesSupported === 1 ? "" : "s"}.`,
        link: { href: `${base}/my-giving`, label: "See my giving history" }
      };
    }
    return null;
  }
  formatGiftDate(value) {
    return value
      ? new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeZone: "UTC"
        }).format(new Date(`${value}T00:00:00Z`))
      : "";
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
