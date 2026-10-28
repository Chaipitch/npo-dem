import { LightningElement, api, wire } from "lwc";
import { markGiftsChanged } from "c/tsAbcHopeGiftEvents";
import askAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.ask";
import usesVerifiedAgent from "@salesforce/apex/TSAbcHopeDonorAgentController.usesVerifiedAgent";
import getMonthlyGifts from "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts";
import {
  campaignCards,
  extractLinks,
  formatDate,
  linkCampaign,
  money,
  recurringGiftCards,
  recurringSummary,
  sitePath,
  splitList
} from "c/tsAbcHopeDashboardUtils";

/** Sent by the portal layout's header question box and "Ask Our AI" (c-ts-abc-hope-portal-layout). */
const ASK_EVENT = "abchope:ask";
/** A question about campaigns or giving: the reply's campaigns show as cards (D-49). */
const CAMPAIGN_QUESTION =
  /campaign|donat|\bgive\b|giving|appeal|drive|fund|christmas|support/i;
/** A line of the agent's recurring gift list, e.g. "2. Recurring (Monthly): USD 500 per month to …" (D-55). */
const RECURRING_LINE =
  /^[ \t]*(?:[-•*]\s*)?(?:\d+[.)]\s*)?Recurring (?:\((?:Weekly|Monthly|Yearly|Custom)\)|gift\b).*$/gim;

/**
 * Donor dashboard Ask panel (D-23, D-51): chat with the ABC Hope Donor Assistant through
 * TSAbcHopeDonorAgentController. Questions typed in the header box or sent with /dashboard?ask=… are asked
 * here. Links in replies become buttons and campaign answers show campaign cards (D-48, D-49). Without a
 * verified agent, personal questions are answered from the dashboard data.
 */
export default class DashboardAssistant extends LightningElement {
  @api campaigns = [];
  @api campaignImages;
  @api currencyLabel = "USD";
  @api donatePath = "/donate";
  /** Suggestion chips, separated by ";". */
  @api suggestionsConfig;
  /** Answer questions from the header box and ?ask= (the home view only). */
  @api acceptsQuestions = false;

  /** The dashboard summary; a question that arrived before it loaded is asked once it is here. */
  @api
  get data() {
    return this._data;
  }
  set data(value) {
    this._data = value;
    this.flushPendingAsk();
  }
  _data;

  /** True when the agent calls carry the donor's verified identity (Agent API, D-23). */
  verifiedAgent = false;
  @wire(usesVerifiedAgent)
  wiredVerifiedAgent({ data }) {
    this.verifiedAgent = data === true;
  }

  chatMessages = [];
  chatDraft = "";
  chatBusy = false;
  chatSessionId;
  _chatSeq = 0;

  connectedCallback() {
    this._onAsk = (event) => this.handleAskEvent(event);
    window.addEventListener(ASK_EVENT, this._onAsk);
    this.readAskFromUrl();
  }
  disconnectedCallback() {
    window.removeEventListener(ASK_EVENT, this._onAsk);
  }
  renderedCallback() {
    this.scrollChatToEnd();
  }

  // ------------------------------------------------------------ questions from the header
  /** The header box or "Ask Our AI" on this page: answer in the panel. */
  handleAskEvent(event) {
    if (!this.acceptsQuestions || !event.detail) return;
    event.detail.handled = true;
    this.focusAgent(event.detail.question);
  }
  /** Arriving from another page with /dashboard?ask=…#agent. */
  readAskFromUrl() {
    if (!this.acceptsQuestions || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const question = params.get("ask");
    if (question === null) return;
    params.delete("ask");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
    this.focusAgent(question);
  }
  focusAgent(question) {
    const text = (question || "").trim();
    if (text) {
      // Personal answers need the dashboard data; wait for it if it is still loading.
      this._pendingAsk = text;
      this.flushPendingAsk();
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      const panel = this.template.querySelector(".agent");
      if (panel?.scrollIntoView) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (!text) {
        this.template.querySelector('[data-id="chat-input"]')?.focus();
      }
    });
  }
  flushPendingAsk() {
    if (!this._pendingAsk || !this._data) return;
    const text = this._pendingAsk;
    this._pendingAsk = undefined;
    this.sendChat(text);
  }
  /** Keep the newest chat message in view inside the panel's scroll area. */
  scrollChatToEnd() {
    const count = this.chatMessages.length + (this.chatBusy ? 1 : 0);
    if (count === this._chatScrolledCount) return;
    this._chatScrolledCount = count;
    const body = this.template.querySelector('[data-id="agent-body"]');
    if (body && count > 0) body.scrollTop = body.scrollHeight;
  }

  // ------------------------------------------------------------ panel content
  get donateHref() {
    return sitePath(this.donatePath);
  }
  get initial() {
    return (this._data?.firstName || "D").charAt(0).toUpperCase();
  }
  get agentIntro() {
    const n = this._data?.causesSupported || 0;
    return n
      ? `You’ve supported ${n} cause${n === 1 ? "" : "s"}. Here’s where your giving went:`
      : "You haven’t made a gift yet — here’s how you can start:";
  }
  /** Top three causes over all years of the impact journey (D-49). */
  get agentCauses() {
    const totals = new Map();
    for (const y of this._data?.journeyYears || []) {
      for (const it of y.items || []) {
        totals.set(it.cause, (totals.get(it.cause) || 0) + (it.amount || 0));
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, amount], i) => ({
        key: `a${i}`,
        label,
        amount: money(amount, this.currencyLabel),
        artClass: `agent-art art-${i % 3}`
      }));
  }
  get suggestions() {
    return splitList(this.suggestionsConfig).map((label, i) => ({
      key: `q${i}`,
      label
    }));
  }

  // ------------------------------------------------------------ chat
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

  addChat(role, rawText, link, gifts) {
    this._chatSeq += 1;
    // With gift cards, the reply's gift lines are dropped: its intro goes above the cards, the rest below (D-55).
    const around = gifts?.length
      ? aroundGiftLines(rawText)
      : { before: rawText, after: "" };
    const text = around.before;
    // Agent replies: links in the text become buttons ("Donate to <campaign>", D-48).
    const parsed =
      role === "agent"
        ? extractLinks(text, {
            campaigns: (this.campaigns || []).map((c) => c.name),
            donatePath: this.donateHref
          })
        : { text, links: [] };
    let links = [...parsed.links];
    if (link && !links.some((l) => l.href === link.href)) links.push(link);
    // Campaign answers show a card per campaign (D-49); its Donate button replaces the plain link.
    const cards =
      role === "agent" ? this.chatCampaignCards(parsed.text, links) : [];
    const shown = new Set(cards.map((c) => c.name.toLowerCase()));
    links = links.filter((l) => !shown.has(linkCampaign(l.href)));
    this.chatMessages = [
      ...this.chatMessages,
      {
        key: `m${this._chatSeq}`,
        text: parsed.text,
        links: links.map((l, i) => ({ ...l, key: `m${this._chatSeq}-l${i}` })),
        cards: cards.map((c) => ({ ...c, key: `m${this._chatSeq}-${c.key}` })),
        hasCards: cards.length > 0,
        giftCards: (gifts || []).map((g) => ({
          ...g,
          key: `m${this._chatSeq}-${g.key}`
        })),
        hasGiftCards: (gifts || []).length > 0,
        textAfter: around.after,
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

  /**
   * Cards for the campaigns an agent reply is about: those it links to, plus those it names when the
   * question was about campaigns or giving (e.g. "Which campaigns are open?").
   */
  chatCampaignCards(text, links) {
    const linked = new Set(links.map((l) => linkCampaign(l.href)));
    const aboutCampaigns = CAMPAIGN_QUESTION.test(this._lastQuestion || "");
    const lower = (text || "").toLowerCase();
    return campaignCards(this.campaigns, {
      campaignImages: this.campaignImages,
      currencyLabel: this.currencyLabel
    }).filter(
      (c) =>
        linked.has(c.name.toLowerCase()) ||
        (aboutCampaigns && lower.includes(c.name.toLowerCase()))
    );
  }

  async sendChat(raw) {
    const text = (raw || "").trim();
    if (!text || this.chatBusy) return;
    this._lastQuestion = text;
    this.addChat("user", text);
    this.chatDraft = "";
    const local = this.localAnswer(text);
    // Without a verified agent session, personal questions are answered here from the dashboard data.
    if (local && !this.verifiedAgent) {
      this.addChat("agent", local.text, local.link);
      return;
    }
    this.chatBusy = true;
    let reply;
    try {
      reply = await askAgent({
        message: text,
        sessionId: this.chatSessionId || null
      });
    } catch {
      reply = { error: "The assistant could not answer right now." };
    }
    if (reply.sessionId) this.chatSessionId = reply.sessionId;
    if (!reply.error) {
      // A recurring gift list in the reply shows as cards instead of text lines (D-55).
      const gifts = await this.recurringGiftsFor(reply.text);
      // Keep the page link the local answer would have offered (e.g. Manage recurring gifts).
      this.addChat("agent", reply.text, local?.link, gifts);
      // The agent may have paused, resumed, changed or cancelled a gift: show the current state.
      if (this.verifiedAgent) markGiftsChanged();
    } else if (local) {
      this.addChat("agent", local.text, local.link);
    } else {
      this.addChat("error", reply.error);
    }
    this.chatBusy = false;
  }

  /**
   * The donor's recurring gifts as cards when the reply lists them; fetched fresh, since the agent may have just
   * paused, resumed, changed or cancelled one. [] when the reply has no list or the gifts cannot be loaded.
   */
  async recurringGiftsFor(text) {
    if (!giftLines(text).length) return [];
    try {
      return recurringGiftCards(await getMonthlyGifts(), {
        currencyLabel: this.currencyLabel
      });
    } catch {
      return [];
    }
  }

  /** Answers about the donor's own giving, from the dashboard data; null = ask the agent. */
  localAnswer(raw) {
    const d = this._data;
    if (!d) return null;
    const q = raw.toLowerCase();
    const monthlyNote = recurringSummary(d);
    if (/monthly|weekly|yearly|recurring|pause|resume|cancel/.test(q)) {
      return {
        text: monthlyNote
          ? `You have ${monthlyNote}. You can pause, resume, change or cancel them on My Giving.`
          : "You don’t have a recurring gift at the moment. You can start a weekly, monthly or yearly gift from any campaign.",
        link: monthlyNote
          ? {
              href: sitePath("/my-giving#monthly"),
              label: "Manage recurring gifts"
            }
          : { href: this.donateHref, label: "Start a recurring gift" }
      };
    }
    if (/history|recent gifts?|past gifts?|last gifts?|receipt/.test(q)) {
      const recent = (d.gifts || []).slice(0, 3).map((g) => {
        const cause = g.designations ? ` to ${g.designations}` : "";
        return `• ${formatDate(g.giftDate)}: ${money(g.amount, this.currencyLabel)}${cause}`;
      });
      return {
        text: recent.length
          ? `Your most recent gifts:\n${recent.join("\n")}`
          : "You haven’t made a gift yet.",
        link: { href: sitePath("/my-giving"), label: "See all my giving" }
      };
    }
    if (/milestone|journey|next step/.test(q)) {
      const steps = (d.journey || []).map((m) => `• ${m.year} — ${m.label}`);
      return {
        text: steps.length
          ? `Your impact journey so far:\n${steps.join("\n")}\nYour next milestone is your next gift.`
          : "Your impact journey starts with your first gift.",
        link: { href: sitePath("/dashboard#journey"), label: "View my journey" }
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
        link: {
          href: sitePath("/dashboard#causes"),
          label: "Explore my causes"
        }
      };
    }
    if (
      /how much|total|i('ve| have) (given|donated)|my (giving|gifts|donations)/.test(
        q
      )
    ) {
      return {
        text: `You’ve given ${money(d.totalContributions || 0, this.currencyLabel)} in total since ${d.supporterSince}, supporting ${d.causesSupported} cause${d.causesSupported === 1 ? "" : "s"}.`,
        link: { href: sitePath("/my-giving"), label: "See my giving history" }
      };
    }
    return null;
  }
}

/** The reply's text before its first recurring gift line and after its last one (the lines show as cards). */
function aroundGiftLines(text) {
  const value = String(text || "");
  const lines = giftLines(value);
  if (!lines.length) return { before: value, after: "" };
  const last = lines[lines.length - 1];
  return {
    before: value.slice(0, lines[0].index).trim(),
    after: value.slice(last.index + last[0].length).trim()
  };
}

/** The reply's recurring gift lines (a fresh regex each time: a shared global one remembers its position). */
function giftLines(text) {
  return [
    ...String(text || "").matchAll(
      new RegExp(RECURRING_LINE.source, RECURRING_LINE.flags)
    )
  ];
}
