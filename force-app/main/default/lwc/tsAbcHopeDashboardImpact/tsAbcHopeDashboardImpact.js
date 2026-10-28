import { LightningElement, api } from "lwc";
import { formatCount, splitList } from "c/tsAbcHopeDashboardUtils";

/** Placeholders → Dashboard fields: sums over active Programs (D-34). */
const IMPACT_FIELDS = {
  programs: "activePrograms",
  peopleReached: "peopleReached",
  communities: "communities",
  volunteers: "volunteersEngaged"
};
const IMPACT_STYLE = [
  { icon: "users", tone: "tone-blue" },
  { icon: "home", tone: "tone-indigo" },
  { icon: "sprout", tone: "tone-green" },
  { icon: "heart-fill", tone: "tone-red" }
];

/** Donor dashboard "Our Shared Impact" tiles (D-34, D-51). */
export default class DashboardImpact extends LightningElement {
  @api data;
  /** "value|label" pairs separated by ";"; {programs}, {peopleReached}, {communities}, {volunteers} are live. */
  @api config;

  get impactTiles() {
    return splitList(this.config).map((item, i) => {
      const [raw, label] = item.split("|").map((x) => (x || "").trim());
      const value = raw.replace(/\{(\w+)\}/g, (token, name) => {
        const field = IMPACT_FIELDS[name];
        if (!field) return token;
        return this.data ? formatCount(this.data[field]) : "…";
      });
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
}
