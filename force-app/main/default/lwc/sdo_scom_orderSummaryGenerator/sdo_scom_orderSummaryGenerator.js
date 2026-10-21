import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getRelatedBuyers from '@salesforce/apex/SDO_SCOM_OrderSummaryGeneratorCtrl.getRelatedBuyers';
import generateRandomOrders from '@salesforce/apex/SDO_SCOM_OrderSummaryGeneratorCtrl.generateRandomOrders';

export default class OrderSummaryGenerator extends LightningElement {
    @api recordId; 
    
    @track selectedContactId = '';
    @track numberOfOrders = 5;
    @track monthsBack = 6;
    
    @track contactOptions = [];
    @track isLoading = false;
    @track isFetchingContacts = true;

    @wire(getRelatedBuyers, { accountId: '$recordId' })
    wiredContacts({ error, data }) {
        if (data) {
            this.contactOptions = data.map(contact => {
                return { label: contact.Name, value: contact.Id };
            });
            this.isFetchingContacts = false;
        } else if (error) {
            this.showToast('Data Error', 'Failed to load related contacts.', 'error');
            this.isFetchingContacts = false;
        }
    }

    get isButtonDisabled() {
        return this.isLoading || this.isFetchingContacts;
    }

    handleContactChange(event) { this.selectedContactId = event.detail.value; }
    handleOrderCountChange(event) { this.numberOfOrders = parseInt(event.target.value, 10); }
    handleMonthsChange(event) { this.monthsBack = parseInt(event.target.value, 10); }

    // Validates all lightning-input and lightning-combobox elements on the page
    validateInputs() {
        const allValid = [...this.template.querySelectorAll('lightning-input, lightning-combobox')]
            .reduce((validSoFar, inputCmp) => {
                inputCmp.reportValidity();
                return validSoFar && inputCmp.checkValidity();
            }, true);
        return allValid;
    }

    handleGenerate() {
        // CLIENT-SIDE VALIDATION: Halt execution if inputs violate min/max rules
        if (!this.validateInputs()) {
            this.showToast('Validation Error', 'Please correct the invalid fields before proceeding.', 'error');
            return;
        }

        this.isLoading = true;
        generateRandomOrders({
            accountId: this.recordId,
            contactId: this.selectedContactId,
            numberOfOrders: this.numberOfOrders,
            monthsBack: this.monthsBack
        })
        .then(result => {
            this.showToast('Operation Successful', result, 'success');
        })
        .catch(error => {
            let errorMsg = error.body ? error.body.message : 'Unknown error occurred.';
            this.showToast('Execution Error', errorMsg, 'error');
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}