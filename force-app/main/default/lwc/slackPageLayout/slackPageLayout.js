import { LightningElement, wire } from 'lwc';
import getSlackOrgDetails from '@salesforce/apex/SlackOrgLinkController.getSlackOrgDetails';

export default class SlackPageLayout extends LightningElement {
    @wire(getSlackOrgDetails)
    wiredOrgDetails;

    get orgDetails() {
        return this.wiredOrgDetails?.data;
    }
}