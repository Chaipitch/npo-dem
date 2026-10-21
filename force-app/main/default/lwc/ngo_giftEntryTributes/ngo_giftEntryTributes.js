import { LightningElement, track, wire } from 'lwc';
import { createRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import getRecentTransaction from '@salesforce/apex/ngo_GiftTributeController.getRecentTransaction';

// Schema
import GIFT_TRIBUTE_OBJECT from '@salesforce/schema/GiftTribute';
import TRIBUTE_TYPE_FIELD from '@salesforce/schema/GiftTribute.TributeType';
import NOTIFICATION_CHANNEL_FIELD from '@salesforce/schema/GiftTribute.NotificationChannel';
import TRANS_ID_FIELD from '@salesforce/schema/GiftTribute.GiftTransactionId';
import COMMITMENT_ID_FIELD from '@salesforce/schema/GiftTribute.GiftCommitmentId';

const FIELD_MAPPING = {
    TributeType: 'TributeType',
    HonoreeContactId: 'HonoreeContactId',
    HonoreeName: 'HonoreeName',
    NotificationContactId: 'NotificationContactId',
    NotificationContactName: 'NotificationContactName',
    NotificationDate: 'NotificationDate',
    NotificationChannel: 'NotificationChannel',
    NotificationEmail: 'NotificationEmail',
    NotificationInfo: 'NotificationInfo',
    NotificationMessage: 'NotificationMessage'
};

export default class Ngo_giftEntryTributes extends LightningElement {
    
    @track tributes = []; 
    parentTransaction = null; 
    isProcessing = false;
    
    @wire(getObjectInfo, { objectApiName: GIFT_TRIBUTE_OBJECT })
    objectInfo;

    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: TRIBUTE_TYPE_FIELD })
    tributeTypeOptions;

    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: NOTIFICATION_CHANNEL_FIELD })
    notificationChannelOptions;

    // Getters for safe picklist loading
    get tributeTypeValues() {
        return this.tributeTypeOptions && this.tributeTypeOptions.data 
            ? this.tributeTypeOptions.data.values 
            : [];
    }

    get notificationChannelValues() {
        return this.notificationChannelOptions && this.notificationChannelOptions.data 
            ? this.notificationChannelOptions.data.values 
            : [];
    }

    connectedCallback() {
        this.addTributeRow();
        this.fetchTransaction();
    }

    fetchTransaction() {
        this.isProcessing = true;
        getRecentTransaction()
            .then(result => {
                if (result) {
                    this.parentTransaction = result;
                    this.showToast('Success', 'Linked to recent Gift Transaction', 'success');
                } else {
                    this.showToast('Warning', 'No recent Gift Transaction found (last 15 min).', 'warning');
                }
            })
            .catch(error => {
                this.showToast('Error', 'Could not fetch transaction: ' + error.body.message, 'error');
            })
            .finally(() => {
                this.isProcessing = false;
            });
    }

    addTributeRow() {
        this.tributes.push({
            key: Date.now() + this.tributes.length, 
            rowNumber: 0, 
            TributeType: '',
            HonoreeContactId: null, 
            HonoreeName: '',
            NotificationContactId: null, 
            NotificationContactName: '',
            NotificationDate: null,
            NotificationChannel: '',
            NotificationEmail: '',
            NotificationInfo: '',
            NotificationMessage: '',
            hasHonoreeContact: false,
            hasNotificationContact: false
        });
        this.recalculateRowNumbers();
    }

    removeTributeRow(event) {
        if (this.tributes.length > 1) {
            const index = event.target.dataset.index;
            this.tributes.splice(index, 1);
            this.recalculateRowNumbers();
        } else {
            this.showToast('Cannot Remove', 'You must have at least one tribute.', 'warning');
        }
    }

    recalculateRowNumbers() {
        this.tributes.forEach((row, i) => {
            row.rowNumber = i + 1;
        });
    }

    handleFieldChange(event) {
        const index = event.target.dataset.index;
        const field = event.target.dataset.field;
        this.tributes[index][field] = event.target.value; 
    }

    handleLookupChange(event) {
        const index = event.target.dataset.index;
        const field = event.target.dataset.field;
        const value = event.detail.recordId; 

        this.tributes[index][field] = value;

        if (field === 'HonoreeContactId') {
            this.tributes[index].hasHonoreeContact = !!value;
            if (!!value) this.tributes[index].HonoreeName = ''; 
        } 
        else if (field === 'NotificationContactId') {
            this.tributes[index].hasNotificationContact = !!value;
            if (!!value) {
                this.tributes[index].NotificationContactName = ''; 
                this.tributes[index].NotificationEmail = ''; 
            }
        }
    }

    // --- SIMPLIFIED SAVE: No ID Swapping ---
    async handleSave() {
        if (!this.parentTransaction) {
            this.showToast('Error', 'Cannot save: No parent Transaction linked.', 'error');
            return;
        }

        const allValid = [...this.template.querySelectorAll('lightning-input, lightning-combobox')]
            .reduce((validSoFar, inputCmp) => {
                inputCmp.reportValidity();
                return validSoFar && inputCmp.checkValidity();
            }, true);

        if (!allValid) {
            this.showToast('Error', 'Please correct the errors on the form.', 'error');
            return;
        }

        this.isProcessing = true;

        try {
            const promises = this.tributes.map(row => {
                const fields = {};
                fields[TRANS_ID_FIELD.fieldApiName] = this.parentTransaction.Id;
                fields[COMMITMENT_ID_FIELD.fieldApiName] = this.parentTransaction.GiftCommitmentId;

                Object.keys(FIELD_MAPPING).forEach(key => {
                    const value = row[key];
                    // Directly assign value (Account ID will be passed here)
                    if (value !== undefined && value !== null && value !== '') {
                        fields[key] = value;
                    }
                });

                const recordInput = { apiName: GIFT_TRIBUTE_OBJECT.objectApiName, fields };
                return createRecord(recordInput);
            });

            await Promise.all(promises);
            this.showToast('Success', `Successfully created ${this.tributes.length} Tribute(s).`, 'success');
            
            this.tributes = [];
            this.addTributeRow();

        } catch (error) {
            // This will catch the "Invalid ID" or "Malformatted ID" error
            this.showToast('Error', 'Error creating records: ' + (error.body ? error.body.message : error.message), 'error');
            console.error('Full Save Error:', JSON.parse(JSON.stringify(error)));
        } finally {
            this.isProcessing = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}