import { LightningElement, api } from "lwc";

// 24x24 stroke icons (Lucide-style geometry, drawn for ABC Hope). Static, trusted markup only.
const ICONS = {
  heart:
    '<path d="M19.5 12.6 12 20l-7.5-7.4A4.9 4.9 0 0 1 12 6.1a4.9 4.9 0 0 1 7.5 6.5Z"/>',
  "heart-fill":
    '<path fill="currentColor" stroke="none" d="M19.5 12.6 12 20l-7.5-7.4A4.9 4.9 0 0 1 12 6.1a4.9 4.9 0 0 1 7.5 6.5Z"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.4.2 4 1.6 4.5 4.3"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M8 17h2"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z"/>',
  sprout:
    '<path d="M12 20v-8"/><path d="M12 12c0-3.6-2.6-6-6.5-6 0 3.8 2.6 6 6.5 6Z"/><path d="M12 13c0-3.3 2.4-5.5 6.5-5.5 0 3.4-2.4 5.5-6.5 5.5Z"/>',
  map: '<path d="M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7Z"/><path d="M9 5v12M15 7v12"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  list: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  sparkle:
    '<path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.3 10.2 12.6 4.5 10.8 10.2 9Z"/><path d="M19 3v3M17.5 4.5h3M5 17v3M3.5 18.5h3"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-3.8 3.7-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
  cap: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14Z"/><path d="M6.5 11.5V16c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4v-4.5M21.5 9.5v5"/>',
  community:
    '<circle cx="12" cy="7" r="2.6"/><circle cx="5.5" cy="10" r="2.1"/><circle cx="18.5" cy="10" r="2.1"/><path d="M7.5 19c.4-3 2.2-4.8 4.5-4.8s4.1 1.8 4.5 4.8M2 18.5c.3-2 1.6-3.3 3.5-3.3M22 18.5c-.3-2-1.6-3.3-3.5-3.3"/>',
  backpack:
    '<path d="M7 9a5 5 0 0 1 10 0v10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5Z"/><path d="M10 4.5V3.5h4v1M9.5 14h5v3h-5ZM7 12H5.5v6H7M17 12h1.5v6H17"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20"/><path d="M12 8.5C10.5 5 7.5 5 7.5 7s2.5 1.5 4.5 1.5ZM12 8.5c1.5-3.5 4.5-3.5 4.5-1.5s-2.5 1.5-4.5 1.5Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  logout:
    '<path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  repeat:
    '<path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19l-3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5l3 3"/>',
  trend: '<path d="m4 17 6-6 4 4 6-6.5"/><path d="M15 8.5h5v5"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

export default class AbcHopeIcon extends LightningElement {
  @api name = "heart";
  @api size = 20;
  @api strokeWidth = 1.8;
  @api label;

  renderedCallback() {
    const host = this.template.querySelector("span");
    if (!host) return;
    const paths = ICONS[this.name] || ICONS.heart;
    const a11y = this.label
      ? `role="img" aria-label="${escapeAttr(this.label)}"`
      : 'aria-hidden="true"';
    // eslint-disable-next-line @lwc/lwc/no-inner-html
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${Number(this.size)}" height="${Number(this.size)}" fill="none" stroke="currentColor" stroke-width="${Number(this.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" ${a11y} style="display:block">${paths}</svg>`;
  }
}

function escapeAttr(v) {
  return String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
