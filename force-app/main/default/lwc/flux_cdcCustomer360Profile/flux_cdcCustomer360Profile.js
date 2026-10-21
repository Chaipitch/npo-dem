import { LightningElement, api, wire } from 'lwc';
import { getFieldValue, getRecord } from 'lightning/uiRecordApi';
import { NavigationMixin } from 'lightning/navigation';

import CARD_BACKGROUND from '@salesforce/resourceUrl/flux_cdcCustomer360Profile_background';

export default class Flux_cdcCustomer360Profile extends NavigationMixin(LightningElement) {

    @api recordId;

    // style definitions
    @api componentHeight = 500;
    @api backgroundColor = 'rgb(6,119,165)';
    @api backgroundColor2 = 'rgb(95,159,180)';

    @api sObjectName = 'Account';

    //avatar image
    @api Avatar = '';
    @api apiFieldName_AvaterImage = '';

    //persona attributes
    @api apiField_FirstName = 'FirstName';
    @api apiField_LastName = 'LastName';
    @api contactName = 'Test';

    @api apiField_Location = 'BillingCity';
    @api location = 'Munich, Germany';

    //customer360attributes
    @api attribute1Icon = 'utility:identity';
    @api attribute1Label = 'Customer Id';
    @api attribute1Value = '12345678';
    @api apiField_Attribute1 = '';

    @api attribute2Icon = 'utility:email';
    @api attribute2Label = 'E-Mail Address';
    @api attribute2Value = 'lauren.bailey@examplecompany.demo';
    @api apiField_Attribute2 = '';

    @api attribute3Icon = 'utility:favorite';
    @api attribute3Label ='Loyalty Status';
    @api attribute3Value = 'Silver';
    @api apiField_Attribute3 = '';
    
    @api attribute4Icon = 'utility:einstein';
    @api attribute4Label ='Activity Affinity';
    @api attribute4Value = 'Hiking';
    @api apiField_Attribute4 = '';
        
    @api attribute5Icon = 'utility:einstein';
    @api attribute5Label ='Propensity to purchase';
    @api attribute5Value = 'Most Likely';
    @api attribute5ShowSlider = false;
    @api attribute5Number = 75;
    @api apiField_Attribute5 = '';
    @api apiField_Attribute5Number = '';

    @api attribute6Icon = 'utility:segments';
    @api attribute6Label ='Segments';
    @api attribute6Value = 'High Propensity to Buy Running Shoes';
    @api apiField_Attribute6 = '';

    @api attribute7Icon = 'utility:cart';
    @api attribute7Label ='Lifetime Value';
    @api attribute7Value = '3000';
    @api apiField_Attribute7 = '';
    @api attribute7Currency = 'EUR';
    @api attribute7CurrencyFormat = 'symbol';

    @api attribute8Icon = 'utility:einstein';
    @api attribute8Label ='Engagement Score';
    @api attribute8Value = '76%';
    @api attribute8Number = 76;
    @api attribute8ShowProgress = false;
    @api apiField_Attribute8 = '';

    get customContainerStyle() {
        return 'min-height: ' + this.componentHeight + 'px; background: ' + this.backgroundColor + '; background-image: linear-gradient(180deg, ' + this.backgroundColor + ' 25%, ' + this.backgroundColor2 + ' 94%);';
    }

    get customBackgroundImage() {
        return 'background-image: url(' + CARD_BACKGROUND + ');'; 
    }

    get customStickyBackground() {
        return 'background-color: ' + this.backgroundColor + ';';
    }

    get customMaskBackground() {
        return 'background-color: ' + this.backgroundColor2 + ';';
    }

    @wire(getRecord, { recordId: '$recordId', layoutTypes: 'Full' }) c360Record;

    get validAvatar() {
        if (this.Avatar != '') {
            return true;
        } else if (this.apiFieldName_AvaterImage != '') {
            return true;
        } else {
            return false;
        }
    }

    get dataName() {
        if (this.c360Record.data != null) {
            if (this.sObjectName == 'Account') {
                return  getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_FirstName);
            } else {
                return  getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_FirstName) + ' ' + getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_LastName);
            }
        } else {
            return this.contactName;
        }
    }

    get dataLocation() {
        if (this.c360Record.data != null) {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Location);
        } else {
            return this.location;
        }
    }

    get avatarImage() {
        if (this.c360Record.data != null && this.apiFieldName_AvaterImage != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiFieldName_AvaterImage);
        } else {
            return this.Avatar;
        }
    }

    get attribute1() {
        if (this.c360Record.data != null && this.apiField_Attribute1 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute1);
        } else {
            return this.attribute1Value;
        }
    }

    get attribute2() {
        if (this.c360Record.data != null && this.apiField_Attribute2 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute2);
        } else {
            return this.attribute2Value;
        }
    }

    get attribute3() {
        if (this.c360Record.data != null && this.apiField_Attribute3 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute3);
        } else {
            return this.attribute3Value;
        }
    }

    get attribute4() {
        if (this.c360Record.data != null && this.apiField_Attribute4 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute4);
        } else {
            return this.attribute4Value;
        }
    }   
    
    get attribute5() {
        if (this.c360Record.data != null && this.apiField_Attribute5 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute5);
        } else {
            return this.attribute5Value;
        }
    }

    get slider5Progress() {
        if (this.c360Record.data != null && this.apiField_Attribute5Number != '') {
            return 'width: ' + getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute5Number) + '%;';
        } else {
            return 'width: ' + this.attribute5Number + '%;';
        }
    }

    get showSlider5() {
        return this.attribute5ShowSlider;
    }

    get attribute6() {
        if (this.c360Record.data != null && this.apiField_Attribute6 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute6);
        } else {
            return this.attribute6Value;
        }
    } 

    get attribute7() {
        if (this.c360Record.data != null && this.apiField_Attribute7 != '') {
            return getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute7);
        } else {
            return this.attribute7Value;
        }
    } 

    get attribute8() {
        if (this.c360Record.data != null && this.apiField_Attribute8 != '') {
            return Number(getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute8)) / 100;
        } else {
            return Number(this.attribute8Number) / 100;
        }
    } 

    get showProgress8() {
        return this.attribute8ShowProgress;
        
    }

    get gaugeStyle() {
        if (this.c360Record.data != null && this.apiField_Attribute8 != '') {
            return 'transform:rotate(' + (180 / 100 * Number(getFieldValue(this.c360Record.data, this.sObjectName + '.' + this.apiField_Attribute8))) + 'deg);';
        } else {
            return 'transform:rotate(' + (180 / 100 * Number(this.attribute8Number)) + 'deg);';
        }
    }

    handleMailClick() {
        var pageRef = {
            type: 'standard__quickAction',
            attributes: {
                apiName: 'Global.SendEmail'
            },
            state: {
                recordId: this.recordId
            }
        };

        this[NavigationMixin.Navigate](pageRef);
    }
}