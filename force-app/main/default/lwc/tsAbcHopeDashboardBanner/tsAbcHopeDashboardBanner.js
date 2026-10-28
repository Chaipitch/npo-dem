import { LightningElement, api } from "lwc";

/** Donor dashboard banner (D-51): a photo (or drawn landscape) with the page title and subtitle. */
export default class DashboardBanner extends LightningElement {
  @api heading;
  @api subtitle;
  @api imageUrl;
  @api imageCredit;
}
