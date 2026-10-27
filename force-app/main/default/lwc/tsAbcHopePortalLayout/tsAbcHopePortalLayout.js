import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import userId from "@salesforce/user/Id";
import isGuest from "@salesforce/user/isGuest";
import FIRST_NAME from "@salesforce/schema/User.FirstName";
import NAME from "@salesforce/schema/User.Name";

const NAV = [
  { label: "Home", path: "/dashboard", icon: "home" },
  { label: "My Giving", path: "/my-giving", icon: "heart" },
  { label: "Campaigns", path: "/dashboard#campaigns", icon: "gift" },
  { label: "Causes I Support", path: "/dashboard#causes", icon: "heart" },
  { label: "My Journey", path: "/dashboard#journey", icon: "map" },
  { label: "Stories", path: "/dashboard#stories", icon: "list" },
  { label: "Ask Our AI", action: "ask", icon: "sparkle" },
  { label: "My Profile", path: "/my-profile", icon: "user" }
];

/**
 * Theme layout for signed-in donor pages (dashboard, giving, profile).
 * @slot header Optional extra header content from Experience Builder
 * @slot footer Optional extra footer content from Experience Builder
 */
export default class AbcHopePortalLayout extends LightningElement {
  @api logoutPath = "/vforcesite/secur/logout.jsp";
  /** Sidebar sprout photo: septian akbar / Unsplash (Unsplash License). */
  @api sidebarImageUrl =
    "https://images.unsplash.com/photo-1734794049686-38f3e8df8b98?auto=format&fit=crop&w=600&q=80";

  drawerOpen = false;
  userMenuOpen = false;
  /** Current path + hash (no query string); drives the active sidebar item. */
  location = currentLocation();

  // The LWR router changes pages without hashchange/popstate: re-read the address on every route change.
  @wire(CurrentPageReference)
  pageChanged() {
    this.syncLocation();
  }

  @wire(getRecord, {
    recordId: isGuest ? null : userId,
    fields: [FIRST_NAME, NAME]
  })
  user;

  connectedCallback() {
    this._onHash = () => this.syncLocation();
    window.addEventListener("hashchange", this._onHash);
    window.addEventListener("popstate", this._onHash);
    this.syncLocation();
  }
  /** Read the address now and again once the router has updated it. */
  syncLocation() {
    this.location = currentLocation();
    this.syncLater();
  }
  syncLater() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      this.location = currentLocation();
    });
  }
  disconnectedCallback() {
    window.removeEventListener("hashchange", this._onHash);
    window.removeEventListener("popstate", this._onHash);
  }

  get firstName() {
    return (
      getFieldValue(this.user?.data, FIRST_NAME) ||
      getFieldValue(this.user?.data, NAME) ||
      "Donor"
    );
  }
  get initial() {
    return (this.firstName || "D").charAt(0).toUpperCase();
  }
  get navItems() {
    const base = basePath || "";
    return NAV.map((n, i) => {
      const href = n.path ? `${base}${n.path}` : "#";
      // Section links (#campaigns…) match their exact hash; page links match their path with no hash.
      const active = !!n.path && this.location === href;
      return {
        ...n,
        key: `nav${i}`,
        href,
        isAction: !!n.action,
        className: active ? "nav-item nav-item_on" : "nav-item",
        ariaCurrent: active ? "page" : null
      };
    });
  }
  get homeHref() {
    return `${basePath || ""}/dashboard`;
  }
  get publicHref() {
    return `${basePath || ""}/`;
  }
  get profileHref() {
    return `${basePath || ""}/my-profile`;
  }
  get logoutHref() {
    return `${basePath || ""}${this.logoutPath}`;
  }
  get sidebarClass() {
    return this.drawerOpen ? "sidebar sidebar_open" : "sidebar";
  }

  toggleDrawer() {
    this.drawerOpen = !this.drawerOpen;
  }
  closeDrawer() {
    this.drawerOpen = false;
  }
  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }
  handleNav(event) {
    this.closeDrawer();
    // Show the clicked item at once; confirm from the address after the browser has moved.
    this.location = event.currentTarget.getAttribute("href");
    this.syncLater();
  }
  handleAsk(event) {
    event.preventDefault();
    this.closeDrawer();
    askAssistant("");
  }
  handleSearchKey(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const question = (event.target.value || "").trim();
    if (!question) return;
    event.target.value = "";
    askAssistant(question);
  }
}

/** "/dashboard#campaigns": path (no trailing slash) + hash, without the query string. */
export function currentLocation() {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path + window.location.hash;
}

/** Window event the dashboard's agent panel listens for (c-ts-abc-hope-donor-dashboard). */
export const ASK_EVENT = "abchope:ask";

/**
 * Sends a question (or just "open the assistant" when empty) to the dashboard agent panel.
 * If the panel is on this page it marks the event handled; otherwise go to the dashboard,
 * which asks the question on load (?ask=) and scrolls to the panel (#agent).
 */
export function askAssistant(question) {
  const detail = { question, handled: false };
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail }));
  if (!detail.handled) {
    const query = question ? `?ask=${encodeURIComponent(question)}` : "";
    window.location.assign(`${basePath || ""}/dashboard${query}#agent`);
  }
}
