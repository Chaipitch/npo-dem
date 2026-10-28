import { LightningElement, api, wire } from "lwc";
import getPrograms from "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms";
import { campaignPhoto } from "c/tsAbcHopeCampaignPhotos";
import { splitList } from "c/tsAbcHopeDashboardUtils";

/**
 * Donor dashboard "Stories From the Programs You Support" (D-51, D-57). Each story names its program; its photo is
 * that program's Image URL (Program.Image_URL__c), else a photo chosen from the program (or tag) name.
 */
export default class DashboardStories extends LightningElement {
  /**
   * "tag|title|summary|program" entries separated by ";". Without a program name, the program whose name matches
   * the tag (e.g. "Clean Water") is used.
   */
  @api config;

  programs = [];
  @wire(getPrograms)
  wiredPrograms({ data }) {
    if (data) this.programs = data;
  }

  get storyCards() {
    return splitList(this.config).map((item, i) => {
      const [tag, title, summary, programName] = item
        .split("|")
        .map((x) => (x || "").trim());
      const program = this.findProgram(programName || tag);
      const photo = campaignPhoto(program?.name || programName || tag, {
        width: 600,
        imageUrl: program?.imageUrl
      });
      return {
        key: `s${i}`,
        tag,
        title,
        summary,
        tagClass: `tag tag-${i % 3}`,
        imageUrl: photo.url,
        imageCredit: photo.credit
      };
    });
  }

  /** The active program with this name; else one whose name starts with it ("Education" → Education Access). */
  findProgram(name) {
    const n = (name || "").toLowerCase();
    if (!n) return undefined;
    return (
      this.programs.find((p) => p.name.toLowerCase() === n) ||
      this.programs.find((p) => p.name.toLowerCase().startsWith(n))
    );
  }
}
