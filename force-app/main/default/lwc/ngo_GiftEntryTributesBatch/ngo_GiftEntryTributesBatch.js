import { LightningElement, track, wire, api } from 'lwc';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';

// Schema
import GIFT_TRIBUTE_OBJECT from '@salesforce/schema/GiftTribute';
import TRIBUTE_TYPE_FIELD from '@salesforce/schema/GiftTribute.TributeType';
import NOTIFICATION_CHANNEL_FIELD from '@salesforce/schema/GiftTribute.NotificationChannel';

export default class Ngo_GiftEntryTributesBatch extends LightningElement {
    
    @track tributes = [];
    _rowData; 

    // --- GRID INTERFACE METHODS ---

    @api
    get rowData() {
        return this._rowData;
    }
    set rowData(value) {
        this._rowData = value || {};
        this.initializeData();
    }

    @api
    getComponentValues() {
        // Return null if empty to clear field, otherwise return JSON string
        const jsonValue = (this.tributes.length > 0) 
            ? JSON.stringify(this.tributes) 
            : null;

        return {
            TributesJSON__c: jsonValue
        };
    }

    @api
    validate() {
        const invalidFields = new Set();
        let isValid = true;

        const inputs = [...this.template.querySelectorAll('lightning-input, lightning-combobox')];
        const inputsValid = inputs.reduce((validSoFar, inputCmp) => {
            inputCmp.reportValidity();
            return validSoFar && inputCmp.checkValidity();
        }, true);

        if (!inputsValid) {
            isValid = false;
            invalidFields.add('Tribute Fields');
        }

        this.tributes.forEach((t, i) => {
            if (!t.TributeType) {
                isValid = false;
                invalidFields.add(`Row ${i + 1}: Missing Tribute Type`);
            }
        });

        return { isValid, invalidFields };
    }

    // --- INTERNAL LOGIC ---

    @wire(getObjectInfo, { objectApiName: GIFT_TRIBUTE_OBJECT })
    objectInfo;

    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: TRIBUTE_TYPE_FIELD })
    tributeTypeOptions;

    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: NOTIFICATION_CHANNEL_FIELD })
    notificationChannelOptions;

    get tributeTypeValues() {
        return this.tributeTypeOptions?.data?.values || [];
    }

    get notificationChannelValues() {
        return this.notificationChannelOptions?.data?.values || [];
    }

    initializeData() {
        if (this._rowData && this._rowData.TributesJSON__c) {
            try {
                this.tributes = JSON.parse(this._rowData.TributesJSON__c);
                this.tributes.forEach(t => {
                    t.hasHonoreeContact = !!t.HonoreeContactId;
                    t.hasNotificationContact = !!t.NotificationContactId;
                    if (!t.key) t.key = Date.now() + Math.random(); 
                });
            } catch (e) {
                this.tributes = [];
                this.addTributeRow();
            }
        } else {
            this.tributes = [];
            this.addTributeRow();
        }
        this.recalculateRowNumbers();
    }

    addTributeRow() {
        this.tributes.push({
            key: Date.now() + Math.random(),
            rowNumber: 0,
            TributeType: '',
            HonoreeContactId: null, // Stores Account ID (001...)
            HonoreeName: '',
            NotificationContactId: null, // Stores Account ID (001...)
            NotificationContactName: '',
            NotificationChannel: '',
            NotificationEmail: '',
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
        } else if (field === 'NotificationContactId') {
            this.tributes[index].hasNotificationContact = !!value;
            if (!!value) {
                this.tributes[index].NotificationContactName = '';
                this.tributes[index].NotificationEmail = '';
            }
        }
    }
}