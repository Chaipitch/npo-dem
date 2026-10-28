import { LightningElement, api } from "lwc";
import { money } from "c/tsAbcHopeDashboardUtils";

const JOURNEY_TONES = ["jt-red", "jt-green", "jt-amber", "jt-purple"];
const JOURNEY_ICONS = ["heart", "sprout", "book", "gift"];
/** Causes shown in a year card before its list scrolls. */
const VISIBLE_ITEMS = 5;

/** Donor dashboard "Your Impact Journey": one card per year (D-35), long years scroll (D-48, D-51). */
export default class DashboardJourney extends LightningElement {
  /** Dashboard.journeyYears, oldest first. */
  @api years = [];
  @api currencyLabel = "USD";

  get journeyYears() {
    return (this.years || []).map((y, i) => {
      const gifts = y.giftCount || 0;
      const items = y.items || [];
      const scrolls = items.length > VISIBLE_ITEMS;
      return {
        ...y,
        key: `y${y.year}`,
        meta: gifts
          ? `${money(y.total, this.currencyLabel)} · ${gifts} gift${gifts === 1 ? "" : "s"}`
          : y.joined
            ? "Became a supporter"
            : "",
        icon: JOURNEY_ICONS[i % JOURNEY_ICONS.length],
        dotClass: `year-dot ${JOURNEY_TONES[i % JOURNEY_TONES.length]}`,
        hasItems: items.length > 0,
        itemsClass: scrolls ? "year-items year-items_scroll" : "year-items",
        // A scrolling list is focusable so keyboard users can scroll it.
        tabIndex: scrolls ? "0" : null,
        listLabel: `Causes supported in ${y.year}`,
        items: items.map((it) => ({
          ...it,
          key: `${y.year}-${it.cause}`,
          amountDisplay: it.recurringOnly
            ? "Recurring gift"
            : money(it.amount, this.currencyLabel)
        }))
      };
    });
  }
}
