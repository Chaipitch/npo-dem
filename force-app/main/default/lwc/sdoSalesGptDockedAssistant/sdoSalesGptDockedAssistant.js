import { LightningElement, wire, track, api } from "lwc";
// import getConfiguration from "@salesforce/apex/EGPT_SalesController.getConfiguration";
// import getEinsteinResponseList from "@salesforce/apex/EGPT_SalesController.getEinsteinResponseList";
// import getUserDetails from "@salesforce/apex/EGPT_SalesController.getUserDetails";
// import getResponse from "@salesforce/apex/OpenAIController.getResponse";

import getUserDetails from "@salesforce/apex/SDO_Sales_GPTController.getUserDetails";
import fetchSimulatedData from "@salesforce/apex/SDO_Sales_GPTController.fetchSimulatedData";
import getGPTConfiguration from "@salesforce/apex/SDO_Sales_GPTController.getGPTConfiguration";

import updateField from '@salesforce/apex/SDO_Sales_GPTController.updateField';
import { updateRecord } from 'lightning/uiRecordApi';

import { NavigationMixin } from "lightning/navigation";

export default class SdoSalesGptDockedAssistant extends NavigationMixin(LightningElement) {
    // ****** Props ******
    @api recordId
    // State
    pannelState = "empty"; // empty | active
    loading = true;
    composerOpen = false;
    // Config
    config;
    user;
    
    @api gptConfiguration;
    @wire(getGPTConfiguration, { configurationId: '$gptConfiguration' })
    wiredRecordMethod({ error, data }) {
        if (data) {
            this.config = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.config = undefined;
        }
    }
    // Data
    responses;

    // @wire(getEinsteinResponseList)
    // wiredResponseList({ error, data }) {
    //     if (data) {
    //         this.responses = data;
    //         this.error = undefined;
    //     } else if (error) {
    //         this.error = error;
    //         this.contacts = undefined;
    //     }
    // }

    @wire(fetchSimulatedData, { einsteinConfigurationId: '$gptConfiguration' })
    wiredMessagesMethod({ error, data }) {
        if (data) {
            console.log('data', data);
            this.responses = data;
            this.error = undefined;
            console.log('data', this.simulatedData);
        } else if (error) {
            this.error = error;
            this.responses = undefined;
            console.log('error', this.error);
        }
    }

    @track messages = [];
    description;
    @track emailBody;

    // ****** Starting State ******

    connectedCallback() {
        this.addEventListeners();
        // this.getConfig();
        this.getUser();
    }

    // getConfig() {
    //     getConfiguration()
    //         .then((result) => {
    //             this.config = result;
    //         })
    //         .catch((error) => {
    //             console.log("Error: ", error);
    //         });
    // }

    getUser() {
        getUserDetails()
            .then((result) => {
                this.user = result;
            })
            .catch((error) => {
                console.log("Error: ", error);
            });
    }

    addEventListeners() {
        window.addEventListener("egpt_togglepannel", this.openSidebar, false);
        window.addEventListener("egpt_messageaction", this.handleMessageAction, false);
        window.addEventListener("egpt_messagetyping", this.handleMessageTyping, false);
    }

    // ****** Event Handling ******

    openSidebar = () => {
        this.toggleSidebar();
    };

    handleMessageTyping = () => {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.scrollToBottom();
        }, 50);
    };

    handleMessageAction = (event) => {
        try {
            let action = event.detail;
            // action.id = event.detail.id;
            // action.targetFieldApiName = event.detail.targetFieldApiName;
            // action.targetRecordId = event.detail.targetRecordId;
            // action.type = event.detail.type;
            // action.updateWith = event.detail.updateWith;
            console.log('handleMessageAction', JSON.stringify(action));
            let pageReference;
            switch (action.type) {
                case "Einstein Message":
                    this.getAnswer(action.NextMessageKeyword__c);
                    break;
                case "Email":
                    this.getAnswer(action.NextMessageKeyword__c);
                    pageReference = this.constructPageReference(
                        action.ActionTarget__c,
                        action.TargetRecordId__c,
                        action.TargetSObjectType__c,
                        action.TargetFieldName__c,
                        action.Content__c
                    );
                    this.publishPageReference(pageReference);
                    break;
                case "Email Composer":
                    console.log('email action',action);
                    let email = {
                        to: action.targetRecordId,
                        subject: action.targetFieldApiName,
                        body: action.updateWith
                    };
                    console.log('email action',JSON.stringify(email));
                    this.emailBody = email;
                    break;
                case "Record Page":
                    pageReference = this.constructPageReference(
                        action.ActionTarget__c,
                        action.TargetRecordId__c,
                        action.TargetSObjectType__c,
                        action.TargetFieldName__c,
                        action.Content__c
                    );
                    this.publishPageReference(pageReference);
                    break;
                case "View":
                    console.log('view');
                    const viewRef = {
                        type: "standard__recordPage",
                        attributes: {
                            recordId: action.targetRecordId,
                            objectApiName: action.recordApiName,
                            actionName: "view"
                        }
                    };
                    this[NavigationMixin.Navigate](viewRef);
                    break;
                case "Edit":
                    console.log('edit');
                    const editRef = {
                        type: "standard__recordPage",
                        attributes: {
                            recordId: action.targetRecordId,
                            objectApiName: action.recordApiName,
                            actionName: "edit"
                        }
                    };
                    this[NavigationMixin.Navigate](editRef);
                    break;
                case "Toggle Next Reply":
                    console.log('Toggle next reply');
                    let nextResponse = this.responses.find((item) => item.id == action.nextReplyId);

                    console.log('next response',nextResponse);
                    this.getAnswer(nextResponse.keyword);
                    break;
                case "Field Update":
                    console.log('Field Update Action', action);
                    updateField({ recordId: action.targetRecordId, fieldNameToUpdate: action.targetFieldApiName, updateWith: action.updateWith })
                        .then(result => {
                            if (result) {
                                // Refresh Record Detail Page
                                updateRecord({ fields: { Id: this.recordId } })
                            }
                        })
                        .catch(error => {
                            console.error('Error calling Apex method:', error);
                        });
                    // pageReference = this.constructPageReference(
                    //   action.ActionTarget__c,
                    //   action.TargetRecordId__c,
                    //   action.TargetSObjectType__c,
                    //   action.TargetFieldName__c,
                    //   action.Content__c
                    // );
                    // this.publishPageReference(pageReference);
                    break;
                default:
                    console.log(`Action not found: ${action.Name} / ${action.ActionTarget__c}.`);
            }
        } catch (error) {
            console.log('egptSidebar Error Log:' + error);
        }
    };

    publishPageReference(value) {
        const customEvent = new CustomEvent("egpt_pagereference", {
            detail: {
                value: value
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(customEvent);
    }

    constructPageReference(type, targetRecordId, targetSobjectType, targetFieldName, targetContent) {
        let pageReference = {
            type: type,
            targetRecordId: targetRecordId,
            targetSObjectType: targetSobjectType,
            targetFieldName: targetFieldName,
            targetContent: targetContent
        };
        return pageReference;
    }

    getAction(value) {
        let message = this.messages.slice(-1)[0];
        let responseAction = message.response.Actions.find((action) => action.Name === value);
        return responseAction;
    }

    // ****** Message Handling ******

    handleInputCommit(event) {
        const keyword = event.target.value;
        let message = this.configureMessage(this.user.SmallPhotoUrl, keyword, null, "", "question");
        this.messages.push(message);
        event.target.value = "";
        this.pannelState = "active";
        this.scrollToBottom();
        this.getAnswer(keyword);
    }

    getAnswer(keyword) {
        this.loading = true;
        this.scrollToBottom();
        const response = this.responses.find((item) => keyword.toLowerCase().includes(item.keyword.toLowerCase()));
        const wait = 2000;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.loading = false;
            let message;
            if (response) {
                message = this.configureMessage(this.user.SmallPhotoUrl, "", response, response.message, "answer");
                if (response.ChangeInteractivePageState__c) {
                    let pageReference = this.constructPageReference(
                        'Record Page',
                        response.TargetRecordId__c,
                        response.TargetSObjectType__c,
                        '',
                        ''
                    );
                    this.publishPageReference(pageReference);
                }

                this.messages.push(message);
            } else {
                    message = this.configureMessage(
                        this.user.SmallPhotoUrl,
                        "",
                        null,
                        "Sorry, I don't know the answer to that question",
                        "unknown"
                    );
                    this.messages.push(message);
            }
            this.scrollToBottom();
        }, wait);
    }

    configureMessage(avatar, question, response, responseText, type) {
        let message = {
            avatar: avatar,
            question: question,
            response: response,
            responseText: responseText,
            type: type
        };
        return message;
    }

    scrollToBottom() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const el = this.template.querySelector(".scroller");
            el.scrollTop = el.scrollHeight;
        });
    }

    minimizeComposer(){
        this.template.querySelector('.einstein-assistant').classList.remove('slds-is-open'); 
        this.composerOpen = false;   
    }
    openComposer(){
        this.template.querySelector('.einstein-assistant').classList.add('slds-is-open');   
        this.composerOpen = true;
    }

    get isComposerOpen(){
        return this.composerOpen;
    }

    get showEmptyPannelState() {
        return this.pannelState === "empty";
    }

    get sidebarIcon() {
        return this.showSidebar ? "utility:chevronright" : "utility:chevronleft";
    }

    disconnectedCallback() {
        window.removeEventListener("openeinstein", this.handleMessage, false);
        window.removeEventListener("messageaction", this.handleMessage, false);
    }

    // getOpenAPIResponse(question) {
    //     getResponse({ searchString: question })
    //         .then((result) => {
    //             let response = JSON.parse(JSON.stringify(JSON.parse(result)));
    //             if (response.error) {
    //                 this.responseData = response.error.message;
    //             } else if (response.choices[0].text) {
    //                 this.responseData = response.choices[0].text;
    //                 this.responseData = this.responseData.replace(/\n/g, "<br />");
    //                 let tempScriptData = "";
    //                 tempScriptData = response.choices[0].text.includes("<script>")
    //                     ? "JS File: " + response.choices[0].text.split("<script>")[1]
    //                     : "";
    //                 tempScriptData = tempScriptData.replace(/\n/g, "<br />");
    //                 this.responseData = this.responseData + tempScriptData;
    //                 this.responseData = this.responseData.includes("XML File:")
    //                     ? this.responseData.split("XML File:")[0]
    //                     : this.responseData;
    //                 this.responseData.trim();
    //             }
    //             let message = this.configureMessage("", "", null, this.responseData.slice(12), "answer");
    //             this.messages.push(message);
    //             this.loading = false;
    //         })
    //         .catch((error) => {
    //             this.loading = false;
    //             console.log("error is " + error);
    //         });
    // }

    renderedCallback() {
        console.log("render run");
    }
}