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
    const photo = images.get(c.name) || campaignPhoto(c.name);
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
