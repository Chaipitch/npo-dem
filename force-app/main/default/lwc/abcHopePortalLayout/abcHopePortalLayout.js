import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import basePath from "@salesforce/community/basePath";
import userId from "@salesforce/user/Id";
import isGuest from "@salesforce/user/isGuest";
import FIRST_NAME from "@salesforce/schema/User.FirstName";
import NAME from "@salesforce/schema/User.Name";

const NAV = [
  { label: "Home", path: "/dashboard", icon: "home" },
  { label: "My Giving", path: "/my-giving", icon: "heart" },
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
  @api sidebarImageUrl =
    "https://images.unsplash.com/photo-1583263840577-b174af9ac796?auto=format&fit=crop&w=600&q=80";

  drawerOpen = false;
  userMenuOpen = false;
  location =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.hash
      : "";

  @wire(getRecord, {
    recordId: isGuest ? null : userId,
    fields: [FIRST_NAME, NAME]
  })
  user;

  connectedCallback() {
    this._onHash = () => {
      this.location = window.location.pathname + window.location.hash;
    };
    window.addEventListener("hashchange", this._onHash);
    window.addEventListener("popstate", this._onHash);
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
      const active =
        n.path &&
        (this.location === href ||
          (!n.path.includes("#") && this.location === `${base}${n.path}`));
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
    this.location = event.currentTarget.getAttribute("href");
  }
  handleAsk(event) {
    event.preventDefault();
    this.closeDrawer();
    launchChat();
  }
  handleSearchKey(event) {
    if (event.key === "Enter") {
      launchChat();
    }
  }
}

function launchChat() {
  const bootstrap = window.embeddedservice_bootstrap;
  if (bootstrap?.utilAPI?.launchChat) {
    bootstrap.utilAPI.launchChat();
  }
}
