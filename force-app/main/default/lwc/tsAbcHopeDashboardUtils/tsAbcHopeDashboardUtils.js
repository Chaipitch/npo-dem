import basePath from "@salesforce/community/basePath";
import { campaignPhoto } from "c/tsAbcHopeCampaignPhotos";

/**
 * Helpers shared by the donor dashboard and its sections (D-51): formatting, the recurring gift summary,
 * campaign card view models (dashboard cards and the assistant's cards) and link parsing for agent replies.
 */

/** "USD 1,250" — whole units, en-US grouping. */
export function money(value, currencyLabel = "USD") {
  const n = Number(value);
  return `${currencyLabel} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)}`;
}

export function formatCount(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/** "a;b;c" → ["a", "b", "c"], blanks dropped. */
export function splitList(value) {
  return String(value || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A yyyy-mm-dd date as "1 Nov 2026" (read as UTC so the day never shifts). */
export function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "UTC"
      }).format(new Date(`${value}T00:00:00Z`))
    : "";
}

export function sitePath(path) {
  return `${basePath || ""}${path}`;
}

/** "2 active recurring gifts (Monthly) · 1 paused until 22 Dec 2026"; "" when there are none. */
export function recurringSummary(data) {
  const n = data?.activeMonthlyGifts || 0;
  const p = data?.pausedMonthlyGifts || 0;
  const parts = [];
  if (n > 0) {
    const types = (data.activeRecurringTypes || []).join(", ");
    parts.push(
      `${n} active recurring gift${n === 1 ? "" : "s"}${types ? ` (${types})` : ""}`
    );
  }
  if (p > 0) {
    const until = data.pausedUntil
      ? ` until ${formatDate(data.pausedUntil)}`
      : "";
    parts.push(`${p} paused${until}`);
  }
  return parts.join(" · ");
}

/**
 * Card view models for open campaigns (getCampaigns): links, photo, progress and labels.
 * campaignImages: "Campaign name|image URL|credit" entries separated by ";" — others get a themed photo.
 */
export function campaignCards(
  campaigns,
  { campaignImages = "", currencyLabel = "USD" } = {}
) {
  const images = new Map(
    splitList(campaignImages).map((entry) => {
      const [name, url, credit] = entry.split("|").map((x) => (x || "").trim());
      return [name, { url, credit: credit || "Photo: Unsplash" }];
    })
  );
  return (campaigns || []).map((c, i) => {
    const goal = Number(c.goal) || 0;
    const raised = Number(c.raised) || 0;
    const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    let timing = "";
    if (c.daysLeft !== null && c.daysLeft !== undefined) {
      timing =
        c.daysLeft === 0
          ? "Ends today"
          : `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`;
    }
    // The campaign's own photo (Image URL, D-56), else the dashboard's campaignImages entry, else its theme photo.
    const photo = c.imageUrl
      ? campaignPhoto(c.name, { imageUrl: c.imageUrl })
      : images.get(c.name) || campaignPhoto(c.name);
    return {
      key: c.id || `c${i}`,
      name: c.name,
      description: c.description,
      href: sitePath(`/donate?campaign=${encodeURIComponent(c.name)}`),
      detailHref: sitePath(`/campaign?name=${encodeURIComponent(c.name)}`),
      donateLabel: `Donate now to ${c.name}`,
      detailLabel: `View more about ${c.name}`,
      imageUrl: photo.url,
      imageCredit: photo.credit,
      raisedDisplay: money(raised, currencyLabel),
      goalDisplay: goal > 0 ? money(goal, currencyLabel) : "",
      hasGoal: goal > 0,
      barStyle: `width: ${pct}%`,
      pctDisplay: `${pct}%`,
      giftsDisplay: c.giftCount
        ? `${c.giftCount} gift${c.giftCount === 1 ? "" : "s"}`
        : "Be the first to give",
      timing,
      programsDisplay: (c.programs || []).join(", "),
      chips: (c.designations || []).map((d, j) => ({ key: `d${j}`, label: d }))
    };
  });
}

/**
 * Pulls links out of an agent reply so they show as buttons, not long URLs: a donation link
 * (/donate?campaign=Name) becomes "Donate to Name", /donate "Donate", anything else "Open link".
 * Markdown links keep their text; a bare URL and a "Donate here:" lead-in before it are removed.
 */
export function extractLinks(
  raw,
  { campaigns = [], donatePath = "/donate" } = {}
) {
  const links = [];
  const add = (href) => {
    const clean = href.replace(/[.,;:!?)]+$/, "");
    if (!links.some((l) => l.href === clean)) {
      links.push({ href: clean, label: linkLabel(clean) });
    }
    return clean;
  };
  let text = String(raw || "").replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (m, label, href) => {
      add(href);
      return label;
    }
  );
  text = text.replace(
    /(?:\b(?:donate|give)(?: here| now)?\s*:\s*|\bhere\s*:\s*)?(https?:\/\/[^\s]+)/gi,
    (m, href) => {
      const clean = add(href);
      return href.slice(clean.length); // keep a full stop that ended the sentence
    }
  );
  // Agentforce replaces links to sites that are not Trusted URLs with "URL_Redacted": rebuild the donation
  // link from the campaign named last before it (same paragraph first), else link to the donate page.
  text = text.replace(
    /(?:\b(?:donate|give|visit)(?: here| now)?\s*:?\s*|\bhere\s*:\s*)?\[?url[_ ]redacted\]?/gi,
    (m, offset, whole) => {
      const before = whole.slice(0, offset);
      const paragraph = before.slice(before.lastIndexOf("\n\n") + 1);
      const campaign =
        lastMentioned(paragraph, campaigns) || lastMentioned(before, campaigns);
      const href = campaign
        ? `${donatePath}?campaign=${encodeURIComponent(campaign)}`
        : donatePath;
      if (!links.some((l) => l.href === href)) {
        links.push({
          href,
          label: campaign ? `Donate to ${campaign}` : "Donate"
        });
      }
      return "";
    }
  );
  text = text
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/([.!?])\.+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(^|\n)\s*[.,;:]\s*(?=\n|$)/g, "$1")
    .trim();
  return { text, links };
}

/** The campaign a /donate?campaign= link points to, lower case; "" for any other link. */
export function linkCampaign(href) {
  try {
    return (
      new URL(href, "https://x.invalid").searchParams.get("campaign") || ""
    ).toLowerCase();
  } catch {
    return "";
  }
}

function lastMentioned(text, names) {
  const lower = text.toLowerCase();
  let best;
  let at = -1;
  for (const n of names) {
    const i = lower.lastIndexOf(String(n).toLowerCase());
    if (i > at) {
      at = i;
      best = n;
    }
  }
  return best;
}

function linkLabel(href) {
  try {
    const url = new URL(href);
    if (/\/donate\/?$/.test(url.pathname)) {
      const campaign = url.searchParams.get("campaign");
      return campaign ? `Donate to ${campaign}` : "Donate";
    }
  } catch {
    // not a URL we can read: generic label
  }
  return "Open link";
}

// Schedule period → label and unit; anything else (e.g. Custom) reads as Monthly (D-24).
const PERIODS = {
  Weekly: { type: "Weekly", unit: "week" },
  Monthly: { type: "Monthly", unit: "month" },
  Yearly: { type: "Yearly", unit: "year" }
};

/**
 * Card view models for the donor's recurring gifts (getMonthlyGifts), numbered in the same order the assistant
 * numbers them, so "pause gift 2" means card 2 (D-55).
 */
export function recurringGiftCards(gifts, { currencyLabel = "USD" } = {}) {
  return (gifts || []).map((g, i) => {
    const period = PERIODS[g.period] || PERIODS.Monthly;
    return {
      key: g.id || `r${i}`,
      number: i + 1,
      typeLabel: `Recurring (${period.type})`,
      amountDisplay: g.amount
        ? `${money(g.amount, currencyLabel)} / ${period.unit}`
        : "Recurring gift",
      cause: [g.designation, g.program ? `${g.program} program` : ""]
        .filter(Boolean)
        .join(" · "),
      campaign: g.campaignName || "",
      statusLabel: g.isPaused
        ? g.pausedUntil
          ? `Paused until ${formatDate(g.pausedUntil)}`
          : "Paused"
        : "Active",
      statusClass: g.isPaused
        ? "gift-status gift-status_paused"
        : "gift-status gift-status_active",
      nextGift:
        !g.isPaused && g.nextGiftDate
          ? `Next gift ${formatDate(g.nextGiftDate)}`
          : ""
    };
  });
}

/** A list line's bullet or number ("- ", "• ", "2. ", "3) "). */
const LIST_MARK = /^\s*(?:[-•*]|\d+[.)])\s+/;
/** A gift's amount, date, causes and campaign, in either order: "USD 1,000 on 10/28/2026 to Books (Toy Drive)"
 * or "10/28/2026: USD 1,000 to Books (Toy Drive)" (also "28 Oct 2026 — …"). */
const AMOUNT = "([A-Z]{3}\\s?[\\d,]+(?:\\.\\d+)?)";
const DATE = "(\\d{1,2}\\/\\d{1,2}\\/\\d{4}|\\d{1,2} [A-Z][a-z]{2,8} \\d{4})";
const CAUSES = "(?:\\s+to\\s+(.+?))?(?:\\s+\\(([^()]+)\\))?\\.?$";
const GIFT_AMOUNT_FIRST = new RegExp(`^${AMOUNT}\\s+on\\s+${DATE}${CAUSES}`);
const GIFT_DATE_FIRST = new RegExp(
  `^${DATE}\\s*(?::|[—–-])\\s*${AMOUNT}${CAUSES}`
);

/**
 * The first list in a chat reply, so it can show as cards (D-60): lines with a bullet or number, or two or more
 * lines in a row of one paragraph (a line ending in ":" stays the list's heading). Gift lines are split into
 * amount, date, causes and campaign; other items into a title and a detail ("Name — detail" or "Name: detail").
 * Returns { before, items, after, gifts } where gifts is true when every item is a gift; items is [] without a list.
 */
export function chatList(text) {
  const value = String(text || "");
  const lines = value.split("\n");
  const isItem = (i) => {
    const line = lines[i]?.trim();
    if (!line) return false;
    if (LIST_MARK.test(line)) return true;
    // A heading ("Your recent gifts:") or a long sentence is text, not a list item.
    if (line.endsWith(":") || line.length > 160) return false;
    // Without bullets, a paragraph's lines are a list when the line next to it is a plain line too (not a
    // heading, and not a bulleted list this line introduces).
    const plain = (other) =>
      Boolean(other) && !other.endsWith(":") && !LIST_MARK.test(other);
    return plain(lines[i - 1]?.trim()) || plain(lines[i + 1]?.trim());
  };
  const start = lines.findIndex((l, i) => isItem(i));
  let end = start;
  while (start >= 0 && end + 1 < lines.length && isItem(end + 1)) end += 1;
  if (start < 0 || end === start) {
    return { before: value.trim(), items: [], after: "", gifts: false };
  }
  const items = lines
    .slice(start, end + 1)
    .map((l, i) => listItem(l.replace(LIST_MARK, "").trim(), i));
  return {
    before: lines.slice(0, start).join("\n").trim(),
    items,
    after: lines
      .slice(end + 1)
      .join("\n")
      .trim(),
    gifts: items.every((it) => it.isGift)
  };
}

function listItem(raw, i) {
  // Bold marks go, and so does a dash or colon left at the end once a link was taken out.
  const line = raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s*[—–:-]\s*$/, "");
  let gift = GIFT_AMOUNT_FIRST.exec(line);
  if (gift)
    gift = {
      amount: gift[1],
      date: gift[2],
      causes: gift[3],
      campaign: gift[4]
    };
  else {
    gift = GIFT_DATE_FIRST.exec(line);
    if (gift)
      gift = {
        date: gift[1],
        amount: gift[2],
        causes: gift[3],
        campaign: gift[4]
      };
  }
  if (gift) {
    return {
      key: `li${i}`,
      isGift: true,
      title: gift.amount.replace(/^([A-Z]{3})(?=\d)/, "$1 "),
      date: giftDate(gift.date),
      detail: gift.causes || "",
      campaign: gift.campaign || ""
    };
  }
  const split = /^(.{2,80}?)(?:\s+[—–]\s+|:\s+)(.+)$/.exec(line);
  return {
    key: `li${i}`,
    isGift: false,
    title: split ? split[1] : line,
    date: "",
    detail: split ? split[2] : "",
    campaign: ""
  };
}

/** "10/28/2026" (month first, as the agent writes it) as "28 Oct 2026"; any other date as written. */
function giftDate(value) {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return us
    ? formatDate(`${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`)
    : value;
}
