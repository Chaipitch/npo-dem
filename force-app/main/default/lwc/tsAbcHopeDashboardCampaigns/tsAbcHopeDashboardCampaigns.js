import { LightningElement, api } from "lwc";
import { campaignCards } from "c/tsAbcHopeDashboardUtils";

/** Donor dashboard campaign cards (D-18, D-32, D-51): a click anywhere on a card opens its detail page. */
export default class DashboardCampaigns extends LightningElement {
  /** Open campaigns (TSAbcHopeDonationIntakeController.getCampaigns). */
  @api campaigns = [];
  /** "Campaign name|image URL|credit" entries separated by ";". */
  @api campaignImages;
  @api currencyLabel = "USD";

  get campaignCards() {
    return campaignCards(this.campaigns, {
      campaignImages: this.campaignImages,
      currencyLabel: this.currencyLabel
    });
  }

  /** Links inside the card keep their own target. */
  handleCampaignClick(event) {
    if (event.target.closest && event.target.closest("a, button")) return;
    const href = event.currentTarget.dataset.href;
    if (href) window.location.assign(href);
  }
}
