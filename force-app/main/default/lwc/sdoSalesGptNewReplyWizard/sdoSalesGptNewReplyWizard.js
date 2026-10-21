import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from "lightning/platformShowToastEvent";
// import {  } from 'lightning/refresh';
import { RefreshEvent, registerRefreshHandler, unregisterRefreshHandler } from "lightning/refresh";
import getSObjects from '@salesforce/apex/SDO_EinsteinCopilot_NewReplyCtrl.getObjectNames';
import getSObjectFields from '@salesforce/apex/SDO_EinsteinCopilot_NewReplyCtrl.getObjectFields';
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import ACTION_OBJECT from "@salesforce/schema/SDO_Sales_GPT_Simulated_Action__c";
import ACTION_TYPE_FIELD from "@salesforce/schema/SDO_Sales_GPT_Simulated_Action__c.Type__c";
import saveReply from '@salesforce/apex/SDO_Sales_GPTController.saveReply';
import saveActions from '@salesforce/apex/SDO_Sales_GPTController.saveActions';
import saveCards from '@salesforce/apex/SDO_Sales_GPTController.saveCards';

import {nanoId} from 'c/xdoToolCommonJs'
import XdoToolTrackingEventHandlerBase from 'c/xdoToolTrackingEventHandlerBase';

export default class SdoSalesGptNewReplyWizard extends XdoToolTrackingEventHandlerBase {
    COMPONENT_NAME = 'SdoSalesGptNewReplyWizard';
    HANDLER_REGISTRATION_DELAY = 100;
	VERSION = 'v1';
	NANOID = nanoId();

    @api recordId
    replyType = 'Email';
    reply;
    name = "";
    keyword = "";

    title = 'Here is a draft message. You can ask me to modify it, copy it, or send it as an email.';
    message = "<p><strong>To: Codey B</strong></p><p>&nbsp;</p><p><strong>Subject: Congratulations on Omega's Expansion!</strong></p><p>&nbsp;</p><p>Dear Mr. B,</p><p>&nbsp;</p><p>Please accept my heartfelt congratulations on Omega's continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p>&nbsp;</p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p>&nbsp;</p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p>&nbsp;</p><p>Warm regards,</p><p>Valerie East</p>";

    emailTo = "Codey B";
    emailSubject = "Congratulations on Omega's Expansion!";
    emailBody = "<p>Dear Mr. B,</p><p>&nbsp;</p><p>Please accept my heartfelt congratulations on Omega's continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p>&nbsp;</p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p>&nbsp;</p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p>&nbsp;</p><p>Warm regards,</p><p>Valerie East</p>";
    card1;
    card2;
    card3;
    cardIcon;
    cardTitle;
    actionUrl;
    flowApiName;
    messagePreview;
    @track sObjects;
    sObjectsLoaded = false;
    selectedObject;
    sObjectSelected = false;
    @track sObjectFields;
    sObjectFieldsLoaded = false;
    selectedField;
    objectNameField = 'Name';
    targetRecordId;
    actionRecordTypeId;
    actionTypes;
    selectedActionType;
    actionTypeSelected = false;
    actionLabel = '';
    disableSubmit = false;
    updateWith;
    useCards = false;
    refreshHandlerID;

    connectedCallback() {
        this.componentName = this.COMPONENT_NAME;
		super.connectedCallback();

        // loadStyle(this, modalOverride);
        this.refreshHandlerID = registerRefreshHandler(
            this.template.host,
            this.refreshHandler.bind(this),
        );
        this.createMessagePreview();
        this.loadSObjects();
    }

    renderedCallback() {
		if (!this.hasRendered) {
			window.setTimeout(this.registerTrackingHandlers.bind(this), 50);
			this.hasRendered = true;
		}
	}
    
    disconnectedCallback() {
        unregisterRefreshHandler(this.refreshHandlerID);
    }


    refreshHandler() {
        return new Promise((resolve) => {
            // console.log('refresh');
            this.replyType = 'Email';
            this.reply = undefined;
            this.name = "";
            this.keyword = "";
            this.title = 'Here is a draft message. You can ask me to modify it, copy it, or send it as an email.';
            this.message = "<p><strong>To: Codey B</strong></p><p>&nbsp;</p><p><strong>Subject: Congratulations on Omega's Expansion!</strong></p><p>&nbsp;</p><p>Dear Mr. B,</p><p>&nbsp;</p><p>Please accept my heartfelt congratulations on Omega's continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p>&nbsp;</p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p>&nbsp;</p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p>&nbsp;</p><p>Warm regards,</p><p>Valerie East</p>";
            this.emailTo = "Codey B";
            this.emailSubject = "Congratulations on Omega's Expansion!";
            this.emailBody = "<p>Dear Mr. B,</p><p>&nbsp;</p><p>Please accept my heartfelt congratulations on Omega's continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p>&nbsp;</p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p>&nbsp;</p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p>&nbsp;</p><p>Warm regards,</p><p>Valerie East</p>";
            this.card1 = {};
            this.card2 = {};
            this.card3 = {};
            this.cardIcon = '';
            this.cardTitle = '';
            this.actionUrl = '';
            this.flowApiName = '';
            this.selectedObject = '';
            this.sObjectSelected = false;
            this.sObjectFieldsLoaded = false;
            this.selectedField = '';
            this.targetRecordId = '';
            this.selectedActionType = '';
            this.actionTypeSelected = false;
            this.actionLabel = '';
            this.disableSubmit = false;
            this.updateWith = '';
            this.useCards = false;
            resolve(true);
        });

    }


    @wire(getObjectInfo, { objectApiName: ACTION_OBJECT })
    results({ error, data }) {
        if (data) {
            this.actionRecordTypeId = data.defaultRecordTypeId;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.actionRecordTypeId = undefined;
        }
    }

    @wire(getPicklistValues, { recordTypeId: "$actionRecordTypeId", fieldApiName: ACTION_TYPE_FIELD })
    picklistResults({ error, data }) {
        if (data) {
            let options = [{ label: 'None', value: null }];
            data.values.forEach((element) => options.push({ label: element.label, value: element.value }));
            // console.log('options', options);
            this.selectedActionType = options[0].value;
            // let actionTypeVals = [];
            // actionTypeVals.concat(data.values);
            // console.log('picklist values',actionTypeVals);
            this.actionTypes = options;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.actionTypes = undefined;
        }
    }

    loadSObjects() {
        getSObjects()
            .then((result) => {
                this.sObjects = result;
                // console.log('data', this.sObjects);
                this.sObjectsLoaded = true;
            })
            .catch((error) => {
                this.error = error;
            });
    }
    loadSObjectFields() {
        getSObjectFields({ objectName: this.selectedObject })
            .then((result) => {
                this.sObjectFields = result;
                // console.log('data', this.sObjectFields);
                this.sObjectFieldsLoaded = true;
            })
            .catch((error) => {
                this.error = error;
            });
    }

    handleNameChange(event) {
        // this.reply = undefined;
        this.name = event.target.value;
        this.createMessagePreview();
    }
    handleKeywordChange(event) {
        this.keyword = event.target.value;
        this.createMessagePreview();
    }
    handleTitleChange(event) {
        this.title = event.target.value;
        this.createMessagePreview();
    }
    handleMessageChange(event) {
        this.message = event.target.value;
        this.createMessagePreview();
    }
    handleToChange(event) {
        this.emailTo = event.target.value;
        this.createEmailTemplate();
        this.createMessagePreview();
    }
    handleSubjectChange(event) {
        this.emailSubject = event.target.value;
        this.createEmailTemplate();
        this.createMessagePreview();
    }
    handleBodyChange(event) {
        this.emailBody = event.target.value;
        this.createEmailTemplate();
        this.createMessagePreview();
    }
    createEmailTemplate() {
        this.message = "<p><strong>To: " + this.emailTo + "</strong></p><p>&nbsp;</p><p><strong>Subject: " + this.emailSubject + "</strong></p><p>&nbsp;</p>" + this.emailBody;
    }
    handleCardNameChange(event) {
        this.card1.name = event.target.value;
        this.createMessagePreview();
    }
    handleCardIconChange(event) {
        this.card1.iconName = event.target.value;
        this.createMessagePreview();
    }
    handleCardDescChange(event) {
        this.card1.description = event.target.value;
        this.createMessagePreview();
    }
    handleListTitleChange(event) {
        this.cardTitle = event.target.value;
        this.createMessagePreview();
    }
    handleListIconChange(event) {
        this.cardIcon = event.target.value;
        this.createMessagePreview();
    }
    handleCard1Change(event) {
        this.card1.description = event.target.value;
        this.createMessagePreview();
    }
    handleCard2Change(event) {
        this.card2.description = event.target.value;
        this.createMessagePreview();
    }
    handleCard3Change(event) {
        this.card3.description = event.target.value;
        this.createMessagePreview();
    }
    handleListUrlChange(event) {
        this.actionUrl = event.target.value;
        this.createMessagePreview();
    }
    handleObjectChange(event) {
        // console.log('value', JSON.parse(JSON.stringify(event.detail.payload.value)));
        this.selectedObject = event.detail.payload.value;
        // console.log('selectedObject', this.selectedObject);
        if (this.selectedObject) {
            if (this.selectedObject === 'Case') {
                this.objectNameField = 'Subject';
            }
            this.sObjectSelected = true;
        } else {
            this.sObjectSelected = false;
        }
    }
    handleObjectChangeForFields(event) {
        // console.log('value', JSON.parse(JSON.stringify(event.detail.payload.value)));
        this.selectedObject = event.detail.payload.value;
        // console.log('selectedObject', this.selectedObject);
        if (this.selectedObject) {
            if (this.selectedObject === 'Case') {
                this.objectNameField = 'Subject';
            }
            this.sObjectSelected = true;
            this.loadSObjectFields();
        } else {
            this.sObjectSelected = false;
        }

    }
    handleFieldSelect(event) {
        // console.log('value', JSON.parse(JSON.stringify(event.detail.payload.value)));
        this.selectedField = event.detail.payload.value;
        // console.log('selectedObject', this.selectedField);
    }
    handleUpdateWithChange(event) {
        this.updateWith = event.target.value;
        // console.log('this.updateWith', this.updateWith);
    }

    handleToChangeStatic(event) {
        this.emailTo = event.target.value;
    }
    handleSubjectChangeStatic(event) {
        this.emailSubject = event.target.value;
    }
    handleBodyChangeStatic(event) {
        this.emailBody = event.target.value;
    }
    handleReplyLookup(event) {
        this.targetRecordId = event.detail
        // console.log(this.targetRecordId);
    }
    handleFlowApiNameChange(event) {
        this.flowApiName = event.target.value;
    }
    handleActionUrlChange(event) {
        this.actionUrl = event.target.value;
    }
    handleLookup(event) {
        this.targetRecordId = event.detail
        // console.log(this.targetRecordId);
    }
    handleActionLabelChange(event) {
        this.actionLabel = event.target.value;
        this.createMessagePreview();
    }
    handleItem1StyleChange(event) {
        this.card1.style = event.target.value;
        this.createMessagePreview();
    }
    handleItem2StyleChange(event) {
        this.card2.style = event.target.value;
        this.createMessagePreview();
    }
    handleItem3StyleChange(event) {
        this.card3.style = event.target.value;
        this.createMessagePreview();
    }
    handleSelectCustomActionType(event) {
        this.selectedActionType = event.target.value;


        if (this.selectedActionType) {
            this.actionTypeSelected = true;
        } else {
            this.actionTypeSelected = false;
        }
        // console.log('selectedActionType', this.selectedActionType);
        this.createMessagePreview();
    }
    handleCardToggle(event) {
        // console.log('card toggle', event.target.checked);
        this.useCards = event.target.checked;
        if (this.isCardsActive) {
            this.card1 = {
                style: "border-bottom: 1px solid rgb(201, 201, 201);",
                description: "",
            };
            this.card2 = {
                style: "border-bottom: 1px solid rgb(201, 201, 201);",
                description: "",
            };
            this.card3 = {
                style: "",
                description: "",
            };
            this.cardIcon = "custom:custom1";
            this.cardTitle = "Custom";
        } else {
            this.card1 = {
                style: "",
                description: "",
            };
            this.card2 = {
                style: "",
                description: "",
            };
            this.card3 = {
                style: "",
                description: "",
            };
            this.cardIcon = "";
            this.cardTitle = "";
        }
        this.createMessagePreview();
    }
    get isActionTypeSelected() {
        return this.actionTypeSelected === true;
    }
    get ifFieldUpdateType() {
        return this.selectedActionType === 'Field Update';
    }
    get ifEmailComposerType() {
        return this.selectedActionType === 'Email Composer';
    }
    get ifToggleNextReplyType() {
        return this.selectedActionType === 'Toggle Next Reply';
    }
    get ifLaunchFlowType() {
        return this.selectedActionType === 'Launch Flow';
    }
    get ifOpenUrlType() {
        return this.selectedActionType === 'Open URL';
    }
    get ifEditRecordType() {
        return this.selectedActionType === 'Edit Record';
    }
    get ifCopyToClipboardType() {
        return this.selectedActionType === 'Copy to Clipboard';
    }

    typeChanged(event) {
        // console.log('event.target.value', event.target.value)
        this.replyType = event.target.value;
        if (this.isEmailType) {
            this.title = 'Here is a draft message. You can ask me to modify it, copy it, or send it as an email.';
            // this.message = "<p><strong>To: Codey B</strong></p><p>&nbsp;</p><p><strong>Subject: Congratulations on Omega's Expansion!</strong></p><p>&nbsp;</p><p>Dear Mr. B,</p><p>&nbsp;</p><p>Please accept my heartfelt congratulations on Omega's continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p>&nbsp;</p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p>&nbsp;</p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p>&nbsp;</p><p>Warm regards,</p><p>Valerie East</p>";
            this.createEmailTemplate();
        }
        if (this.isSummaryType) {
            this.title = "Here's the summary for <a href=''>Omega AI</a>.";
            this.message = "<p><strong>Account History</strong></p><p>Omega AI, headquartered in San Francisco, CA, is a global technology firm specializing in cutting-edge solutions for various industries. With a strong commitment to sustainability, Omega AI collaborates with partners to develop innovative technologies that address the evolving needs of businesses. From automation and artificial intelligence to data analytics and beyond, Omega's portfolio includes groundbreaking products and services designed to streamline operations and enhance productivity.</p><p>&nbsp;</p><p><strong>Recent News</strong></p><p>In recent news, Omega AI has announced its ambitious plans for further expansion in the US market. The company aims to establish a dominant presence in major cities across the country, offering American businesses access to advanced technological solutions. By expanding its reach, Omega AI seeks to foster innovation and drive digital transformation across the United States, envisioning a future where technology serves as a catalyst for progress, economic growth, and sustainable development.</p>";
        }
        if (this.isSingleRecordType) {
            // const multiCombobox = this.template.querySelector('c-sdo-sales-gpt-combobox');
            // multiCombobox.refreshOptions(this.sObjects);
            this.title = "Sure, here's <a href=''>Codey B</a>.";
            this.message = "";
            this.card1 = {
                iconName: "standard:contact",
                description: "<p>Account: <strong>Omega AI</strong></p><p>Title: <strong>Chief Technology Officer</strong></p><p>Email: <strong>codeyb@example.com</strong></p>",
                name: "Codey B"
            };
        }
        if (this.isMultipleRecordsType) {
            let today = new Date();
            const todayDate = new Date();
            const todayPlus30 = new Date(today.setDate(today.getDate() + 30));
            this.title = "I found these Opportunities that match your request.";
            this.message = "";
            this.card1 = {
                style: "border-bottom: 1px solid rgb(201, 201, 201);",
                description: "<p>Name: <a href='' target=\"_blank\"><strong>Omega - New Business 50K</strong></a></p><p>Account Name: <a href='' target=\"_blank\"><strong>Omega AI</strong></a></p><p>Stage: <strong>Needs Analysis</strong></p><p>Amount: <strong>$50,000.00</strong></p><p>Close Date: <strong>" + this.getRandomDate(todayDate, todayPlus30).toLocaleDateString('en-us') + "</strong></p>",
            };
            this.card2 = {
                style: "border-bottom: 1px solid rgb(201, 201, 201);",
                description: "<p>Name: <a href='' target=\"_blank\"><strong>Omega - Add-On Business 10K</strong></a></p><p>Account Name: <a href='' target=\"_blank\"><strong>Omega AI</strong></a></p><p>Stage: <strong>Id. Decision Makers</strong></p><p>Amount: <strong>$10,000.00</strong></p><p>Close Date: <strong>" + this.getRandomDate(todayDate, todayPlus30).toLocaleDateString('en-us') + "</strong></p>",
            };
            this.card3 = {
                description: "<p>Name: <a href='' target=\"_blank\"><strong>Omega - New Business 120K</strong></a></p><p>Account Name: <a href='' target=\"_blank\"><strong>Omega AI</strong></a></p><p>Stage: <strong>Needs Analysis</strong></p><p>Amount: <strong>$120,000.00</strong></p><p>Close Date: <strong>" + this.getRandomDate(todayDate, todayPlus30).toLocaleDateString('en-us') + "</strong></p>",
            };
            this.cardIcon = "standard:opportunity";
            this.cardTitle = "Opportunities";
            this.actionUrl = "/lightning/o/Opportunity/list";


        }
        if (this.isCustomType) {
            // let today = new Date();
            // const todayDate = new Date();
            // const todayPlus30 = new Date(today.setDate(today.getDate() + 30));
            this.title = "I found these things that match your request.";
            this.message = "";
            this.actionLabel = "View"
            this.actionUrl = "/analytics/home";
        }
        this.createMessagePreview();
    }

    get isEmailType() {
        return this.replyType === 'Email';
    }
    get isSummaryType() {
        return this.replyType === 'Summarize Record';
    }
    get isSingleRecordType() {
        return this.replyType === 'Return Single Record';
    }
    get isMultipleRecordsType() {
        return this.replyType === 'Return Multiple Records';
    }
    get isCustomType() {
        return this.replyType === 'Custom';
    }
    get notRecordType() {
        return (this.replyType !== 'Return Multiple Records' && this.replyType !== 'Return Single Record' && this.replyType !== 'Email');
    }
    get isCardsActive() {
        return this.useCards === true;
    }
    createMessagePreview() {
        let message = {
            id: "preview-1",
            keyword: this.keyword,
            message: this.message,
            messageType: this.replyType,
            name: this.name,
            title: this.title,
            actions: [],
            cards: []
        }
        if (this.isEmailType) {
            message.actions.push({
                "disabled": false,
                "id": "1",
                "name": "Copy",
                "type": "Copy to Clipboard"
            });
            message.actions.push({
                "disabled": false,
                "emailBody": "<p>Dear Mr. B,</p><p><br></p><p>Please accept my heartfelt congratulations on Omega&#39;s continued expansion into the US market! As you are aware, Cirrus and Omega have enjoyed a fruitful partnership in the Global Market which resulted in generating over $10.5 million in revenue.</p><p><br></p><p>Given our past successful collaboration, we strongly believe that there is an immense opportunity to extend our partnership to assist in your growing US market efforts. I would be grateful if we could schedule a call to explore potential collaboration opportunities in detail.</p><p><br></p><p>Please let me know your availability, and I will be happy to coordinate a mutually convenient time.</p><p><br></p><p>Warm regards,</p><p>Valerie East</p>",
                "emailSubject": "Congratulations on Omega's Expansion!",
                "emailTo": "Codey B",
                "id": "2",
                "name": "Preview",
                "type": "Email Composer"
            });
        }
        if (this.isSummaryType) {
            message.actions.push({
                "disabled": false,
                "id": "1",
                "name": "Copy",
                "type": "Copy to Clipboard"
            });
        }
        if (this.isSingleRecordType) {
            message.actions.push({
                "disabled": false,
                "id": "action-edit",
                "name": "Edit Record",
                "targetRecordId": "blank",
                "type": "Edit Record"
            });

            message.cards.push(this.card1);
        }
        if (this.isMultipleRecordsType) {
            message.actions.push({
                "disabled": false,
                "id": "action-listview",
                "name": "View More",
                "type": "Open URL",
                "url": "/lightning/o/Opportunity/list"
            })
            message.cardIcon = this.cardIcon;
            message.cardTitle = this.cardTitle;
            this.card1.style = "border-bottom: 1px solid rgb(201, 201, 201)";
            this.card2.style = "border-bottom: 1px solid rgb(201, 201, 201)";
            message.cards.push(this.card1);
            message.cards.push(this.card2);
            message.cards.push(this.card3);
        }
        if (this.isCustomType) {
            message.cardIcon = this.cardIcon;
            message.cardTitle = this.cardTitle;
            if(this.isCardsActive) {
                message.cards.push(this.card1);
                message.cards.push(this.card2);
                message.cards.push(this.card3);
            }
            if (this.isActionTypeSelected) {
                message.actions.push({
                    "disabled": false,
                    "id": "action-custom",
                    "name": this.actionLabel
                })
            } else {
                message.actions = [];
            }
        }
        // console.log('message', message);
        this.messagePreview = message;
    }
    getRandomDate(startDate, endDate) {
        const timeDiff = endDate.getTime() - startDate.getTime();
        const randomTime = Math.random() * timeDiff;
        const randomDate = new Date(startDate.getTime() + randomTime);
        return randomDate;
    }
    get areSObjectsLoaded() {
        return this.sObjectsLoaded === true;
    }
    get isSObjectSelected() {
        return this.sObjectSelected === true;
    }
    get areSObjectFieldsLoaded() {
        return this.sObjectFieldsLoaded === true;
    }


    // closeAction() {
    //     this.dispatchEvent(new CloseActionScreenEvent());
    //     // refreshApex(this.sObjects);
    //     // this.dispatchEvent(new RefreshEvent());
    // }
    saveAction() {
        this.disableSubmit = true;
        let reply;
        let actions;
        let cards;
        if (this.isEmailType) {
            reply = this.createEmailReply();
            //Insert Reply Record and pass in recordid to nexxt method
            saveReply({ reply: reply })
                .then(result => {
                    this.reply = result;
                    actions = this.createEmailAction(result.Id);
                    saveActions({ actions: actions })
                        .then(actionResult => {
                            // console.log('Email', JSON.parse(JSON.stringify(actionResult)));
                            this.successToast();
                        })
                        .catch(error => {
                            this.error = error;
                        });
                })
                .catch(error => {
                    this.error = error;
                });

        }
        if (this.isSummaryType) {
            reply = this.createSummaryReply();
            saveReply({ reply: reply })
                .then(result => {
                    this.reply = result;
                    actions = this.createSummaryAction(result.Id);
                    saveActions({ actions: actions })
                        .then(actionResult => {
                            // console.log('Summary', JSON.parse(JSON.stringify(actionResult)));
                            this.successToast();
                        })
                        .catch(error => {
                            this.error = error;
                        });
                })
                .catch(error => {
                    this.error = error;
                });

        }
        if (this.isSingleRecordType) {
            reply = this.createSingleRecordReply();
            saveReply({ reply: reply })
                .then(result => {
                    this.reply = result;
                    actions = this.createSingleRecordAction(result.Id);
                    cards = this.createSingleRecordCard(result.Id);
                    saveActions({ actions: actions })
                        .then(actionResult => {
                            // console.log(JSON.parse(JSON.stringify(actionResult)));
                            saveCards({ cards: cards })
                                .then(cardResult => {
                                    // console.log('Single Rec', JSON.parse(JSON.stringify(cardResult)));
                                    this.successToast();
                                })
                                .catch(error => {
                                    this.error = error;
                                });
                        })
                        .catch(error => {
                            this.error = error;
                        });
                })
                .catch(error => {
                    this.error = error;
                });
        }
        if (this.isMultipleRecordsType) {
            reply = this.createMultipleRecordsReply();
            saveReply({ reply: reply })
                .then(result => {
                    this.reply = result;
                    actions = this.createMultipleRecordsAction(result.Id);
                    cards = this.createMultipleRecordsCard(result.Id);
                    saveActions({ actions: actions })
                        .then(actionResult => {
                            // console.log(JSON.parse(JSON.stringify(actionResult)));
                            saveCards({ cards: cards })
                                .then(cardResult => {
                                    // console.log('Multi Rec', JSON.parse(JSON.stringify(cardResult)));
                                    this.successToast();
                                })
                                .catch(error => {
                                    this.error = error;
                                });
                        })
                        .catch(error => {
                            this.error = error;
                        });
                })
                .catch(error => {
                    this.error = error;
                });
        }
        if (this.isCustomType) {
            reply = this.createCustomReply();
            saveReply({ reply: reply })
                .then(result => {
                    this.reply = result;
                    // console.log("reply", this.reply);
                    actions = this.createCustomAction(result.Id);
                    // console.log('actions', actions);
                    cards = this.createCustomCard(result.Id);
                    // console.log('cards', cards);
                    if (this.isActionTypeSelected && this.isCardsActive) {
                        // console.log('Both Cards and Actions', cards, actions);
                        saveActions({ actions: actions })
                            .then(actionResult => {
                                // console.log('Custom Actions', JSON.parse(JSON.stringify(actionResult)));
                                saveCards({ cards: cards })
                                    .then(cardResult => {
                                        // console.log('Custom Cards', JSON.parse(JSON.stringify(cardResult)));
                                        this.successToast();
                                    })
                                    .catch(error => {
                                        this.error = error;
                                    });
                            })
                            .catch(error => {
                                this.error = error;
                            });
                    } else if (this.isActionTypeSelected && !this.isCardsActive) {
                        // console.log('Actions without Cards', actions);
                        saveActions({ actions: actions })
                            .then(actionResult => {
                                // console.log('Custom Actions', JSON.parse(JSON.stringify(actionResult)));
                                this.successToast();
                            })
                            .catch(error => {
                                this.error = error;
                            });
                    } else if (this.isCardsActive && !this.isActionTypeSelected) {
                        // console.log('Cards without Actions', cards);
                        saveCards({ cards: cards })
                            .then(cardResult => {
                                // console.log('Custom Cards', JSON.parse(JSON.stringify(cardResult)));
                                this.successToast();
                            })
                            .catch(error => {
                                this.error = error;
                            });
                    } else {
                        // console.log('no cards or action');
                        this.successToast();
                    }

                })
                .catch(error => {
                    this.error = error;
                });
        }
    }
    createEmailReply() {
        let reply = {
            Name: this.name,
            Keyword__c: this.keyword,
            Title__c: this.title,
            Message_Type__c: this.replyType,
            Message__c: this.message,
            Einstein_GPT_Configuration__c: this.recordId
        };
        return reply;
    }
    createEmailAction(replyId) {
        let action1 = {
            Name: "Copy",
            Type__c: "Copy to Clipboard",
            Sales_GPT_Simulated_Reply__c: replyId
        };
        let action2 = {
            Name: "Preview",
            Type__c: "Email Composer",
            Sales_GPT_Simulated_Reply__c: replyId,
            Email_To__c: this.emailTo,
            Email_Subject__c: this.emailSubject,
            Email_Body__c: this.emailBody,
        };
        return [action1, action2];

    }
    createSummaryReply() {
        let reply = {
            Name: this.name,
            Keyword__c: this.keyword,
            Title__c: this.title,
            Message_Type__c: this.replyType,
            Message__c: this.message,
            Einstein_GPT_Configuration__c: this.recordId
        };
        return reply;
    }
    createSummaryAction(replyId) {
        let action1 = {
            Name: "Copy",
            Type__c: "Copy to Clipboard",
            Sales_GPT_Simulated_Reply__c: replyId
        };
        return [action1];

    }
    createSingleRecordReply() {
        let reply = {
            Name: this.name,
            Keyword__c: this.keyword,
            Title__c: this.title,
            Message_Type__c: this.replyType,
            Einstein_GPT_Configuration__c: this.recordId
        };
        return reply;
    }
    createSingleRecordAction(replyId) {
        let action1 = {
            Name: "Edit Record",
            Type__c: "Edit Record",
            Target_Record_Id__c: this.targetRecordId,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        return [action1];

    }
    createSingleRecordCard(replyId) {
        let card1 = {
            Card_Title__c: this.card1.name,
            Description__c: this.card1.description,
            Card_Icon_Name__c: this.card1.iconName,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        return [card1];

    }
    createMultipleRecordsReply() {
        let reply = {
            Name: this.name,
            Keyword__c: this.keyword,
            Title__c: this.title,
            List_View_Title__c: this.cardTitle,
            List_View_Icon__c: this.cardIcon,
            Message_Type__c: this.replyType,
            Einstein_GPT_Configuration__c: this.recordId
        };
        return reply;
    }
    createMultipleRecordsAction(replyId) {
        let action1 = {
            Name: "View More",
            Type__c: "Open URL",
            URL__c: this.actionUrl,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        return [action1];

    }
    createMultipleRecordsCard(replyId) {
        let card1 = {
            Description__c: this.card1.description,
            Style__c: this.card1.style,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        let card2 = {
            Description__c: this.card2.description,
            Style__c: this.card2.style,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        let card3 = {
            Description__c: this.card3.description,
            Style__c: this.card3.style,
            Sales_GPT_Simulated_Reply__c: replyId
        };
        return [card1, card2, card3];

    }

    createCustomReply() {
        let reply = {
            Name: this.name,
            Keyword__c: this.keyword,
            Title__c: this.title,
            Message__c: this.message,
            Message_Type__c: this.replyType,
            Einstein_GPT_Configuration__c: this.recordId
        };

        if (this.isCardsActive) {
            reply.List_View_Title__c = this.cardTitle;
            reply.List_View_Icon__c = this.cardIcon;
        }
        return reply;
    }
    createCustomAction(replyId) {
        if (this.isActionTypeSelected) {
            // console.log('Action Type Selected');
            let action = {
                Type__c: this.selectedActionType,
                Sales_GPT_Simulated_Reply__c: replyId
            };
            if (this.ifCopyToClipboardType) {
                action.Name = 'Copy';
            } else {
                action.Name = this.actionLabel;
            }

            if (this.ifEditRecordType) {
                action.Target_Record_Id__c = this.targetRecordId;
            }
            if (this.ifFieldUpdateType) {
                action.Target_Record_Id__c = this.targetRecordId;
                action.Target_Field_Api_Name__c = this.selectedField;
                action.Update_With__c = this.updateWith;
            }
            if (this.ifEmailComposerType) {
                action.Email_To__c = this.emailTo;
                action.Email_Subject__c = this.emailSubject;
                action.Email_Body__c = this.emailBody
            }
            if (this.ifToggleNextReplyType) {
                action.Sales_GPT_Next_Reply__c = this.targetRecordId;
            }
            if (this.ifLaunchFlowType) {
                action.Flow_API_Name__c = this.flowApiName;
            }
            if (this.ifOpenUrlType) {
                action.URL__c = this.actionUrl;
            }
            // console.log('action', action);
            return [action];
        } else {
            return [];
        }

    }
    createCustomCard(replyId) {
        if (this.isCardsActive) {
            var cardArray = [];
            let card1 = {
                Description__c: this.card1.description,
                Style__c: this.card1.style,
                Sales_GPT_Simulated_Reply__c: replyId
            };
            if (card1.Description__c !== '') {
                cardArray.push(card1);
            }
            let card2 = {
                Description__c: this.card2.description,
                Style__c: this.card2.style,
                Sales_GPT_Simulated_Reply__c: replyId
            };
            if (card2.Description__c !== '') {
                cardArray.push(card2);
            }
            let card3 = {
                Description__c: this.card3.description,
                Style__c: this.card3.style,
                Sales_GPT_Simulated_Reply__c: replyId
            };
            if (card3.Description__c !== '') {
                cardArray.push(card3);
            }
            return cardArray;
        } else {
            return [];
        }


    }

    get isButtonDisabled() {
        return this.disableSubmit;
    }
    successToast() {
        const event = new ShowToastEvent({
            title: 'Success!',
            message: 'Your Simulated Einstein Copilot Reply was created.',
            variant: 'success',
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
        this.refreshComponent();
        // getRecordNotifyChange([{recordId: this.reply.Id}]);
    }
    refreshComponent() {
        // console.log('this.reply.id',this.reply.Id);
        // this.name = '';
        // this.keyword = '';
        // this.reply = undefined;
        // this.disableSubmit = false;
        this.dispatchEvent(new RefreshEvent());
        // eval("$A.get('e.force:refreshView').fire();");
        // refreshApex(this.replies);
        // this[NavigationMixin.Navigate]({
        //     type: 'standard__recordPage',
        //     attributes: {
        //         recordId: this.reply.Id,
        //         actionName: 'view',
        //     },
        // })
    }
}