import { LightningElement, api } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';

export default class SdoSalesGptLookupComponent extends LightningElement {
    @api sobjectName;
    @api title;
    @api recId;

    handleLookup(event) {
        this.recId = event.detail
        // this.name = event.target.value;
        this.dispatchEvent(new FlowAttributeChangeEvent('recId', this.recId));
    }
}