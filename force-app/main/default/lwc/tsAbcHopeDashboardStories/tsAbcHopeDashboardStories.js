import { LightningElement, api } from "lwc";
import { splitList } from "c/tsAbcHopeDashboardUtils";

const STORY_ART = ["water", "school", "sprout"];
// Free Unsplash photos (Unsplash License).
const unsplash = (id, w) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
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

/** Donor dashboard "Stories From the Programs You Support" (D-51). */
export default class DashboardStories extends LightningElement {
  /** "tag|title|summary" triples separated by ";". */
  @api config;

  get storyCards() {
    return splitList(this.config).map((item, i) => {
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
}
