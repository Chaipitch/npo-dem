import { LightningElement, api, wire, track} from 'lwc';
// import { getRecord } from 'lightning/uiRecordApi';
// import getMessagePreview from '@salesforce/apex/SDO_Sales_GPTController.fetchReplyPreview';
import einsteinAvatarResource from '@salesforce/resourceUrl/SDOSalesGptAvatar';

export default class SdoSalesGptWizardPreview extends LightningElement {
    einsteinAvatar = einsteinAvatarResource;
    // @api recordId;
    @api message;
    // @wire(getMessagePreview, {replyId: '$recordId'}) 
    // wiredRecordMethod({error, data}){
    //     if(data){
    //         this.message = data;
    //         console.log('data',data);
    //         this.error = undefined;
    //     } else{
    //         this.error = error;
    //         this.message = undefined;
    //     }
    // }

    get isMultipleRecType(){
        return this.message.messageType === 'Return Multiple Records';
    }

    get isSingleRecType(){
        return this.message.messageType === 'Return Single Record';
    }

    get hasMessageAndTitle(){
        return (this.message.message && this.message.title);
    }
    get isCustomType(){
        return this.message.messageType === 'Custom';
    }
}