import { LightningElement, api } from "lwc";
import basePath from "@salesforce/community/basePath";
import isGuest from "@salesforce/user/isGuest";

/**
 * Public theme layout for the ABC Hope site (home, donate, login pages).
 * @slot header Optional extra header content from Experience Builder
 * @slot footer Optional extra footer content from Experience Builder
 */
export default class AbcHopePublicLayout extends LightningElement {
  /** "Label|/path" pairs separated by ";" */
  @api navItems = "Our Work|/our-work;Get Involved|/donate;About|/about";
  @api donateLabel = "Donate";
  @api donatePath = "/donate";
  @api dashboardPath = "/dashboard";
  @api tagline = "Together for brighter tomorrows";

  menuOpen = false;

  get isGuest() {
    return isGuest;
  }
  get homeHref() {
    return `${basePath || ""}/`;
  }
  get donateHref() {
    return this.href(this.donatePath);
  }
  get dashboardHref() {
    return this.href(this.dashboardPath);
  }
  get signInHref() {
    return `${basePath || ""}/login?startURL=${encodeURIComponent(this.href(this.dashboardPath))}`;
  }
  get links() {
    const current =
      typeof window !== "undefined" ? window.location.pathname : "";
    return String(this.navItems || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item, i) => {
        const [label, path] = item.split("|").map((x) => (x || "").trim());
        const href = this.href(path || "/");
        return {
          key: `n${i}`,
          label,
          href,
          className:
            href === current && path !== "/"
              ? "nav-link nav-link_on"
              : "nav-link"
        };
      });
  }
  get navClass() {
    return this.menuOpen ? "nav nav_open" : "nav";
  }
  get year() {
    return new Date().getFullYear();
  }

  href(path) {
    const p = String(path || "/");
    return `${basePath || ""}${p.startsWith("/") ? p : `/${p}`}`;
  }
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}
