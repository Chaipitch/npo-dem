import { LightningElement } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';

export default class OpenLinkInNewTab extends NavigationMixin(LightningElement) {
  linkUrl = '/lightning/page/omnistudio/omniscript?omniscript__type=SPCM&omniscript__subType=SubmitReferral&omniscript__language=English&omniscript__theme=lightning&omniscript__tabIcon=custom:custom18&omniscript__tabLabel=Referral%20Intake';
  
  handleButtonClick() {
    this[NavigationMixin.Navigate]({
      type: 'standard__webPage',
      attributes: {
        url: this.linkUrl
      }
    });
  }
}