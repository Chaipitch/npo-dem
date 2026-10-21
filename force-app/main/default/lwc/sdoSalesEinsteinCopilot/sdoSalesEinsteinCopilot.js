import { LightningElement, wire, track, api } from "lwc";

// Apex Imports
import getGPTConfiguration from "@salesforce/apex/SDO_Sales_GPTController.getGPTConfiguration";
import getUserDetails from "@salesforce/apex/SDO_Sales_GPTController.getUserDetails";
import fetchSimulatedData from "@salesforce/apex/SDO_Sales_GPTController.fetchSimulatedData";
import updateField from '@salesforce/apex/SDO_Sales_GPTController.updateField';

// Utility Imports
import { updateRecord } from 'lightning/uiRecordApi';
import { NavigationMixin } from "lightning/navigation";
import { nanoId } from 'c/xdoToolCommonJs'
import XdoToolTrackingEventHandlerBase from 'c/xdoToolTrackingEventHandlerBase';

// Static Resources
import einsteinAvatarResourceIcon from '@salesforce/resourceUrl/SDOSalesGptAvatarIcon';
import einsteinWelcomeImage from '@salesforce/resourceUrl/SDOEinsteinWelcomeImage';
import einsteinWelcomeBG from '@salesforce/resourceUrl/SDOEinsteinWelcomeBG';
import SDO_Agentforce_SVG from '@salesforce/resourceUrl/SDO_Agentforce_SVG';
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class SdoSalesEinsteinCopilot extends XdoToolTrackingEventHandlerBase {
    // Builder Properties
    @api recordId;
    @api panelToggleIconClass = 'utility:right';
    // @api einsteinMenuIconClass = 'einsteinMenuIconActive';
    @api contentHeight = 87;
    @api contentUpdateIsRunning = false;
    @api headerTitle = 'Agentforce';
    @api einsteinGreeting = 'Hi! Agentforce can do things like search for information, summarize records, and draft and revise emails. What do you want to do today?';

    // Mixpanel Tracking Properties
    COMPONENT_NAME = 'SdoSalesGptAssistant';
    HANDLER_REGISTRATION_DELAY = 100;
    VERSION = 'v1';
    NANOID = nanoId();

    // widthPercent = 30;
    // overlayWidth = `width: ${this.widthPercent}vW;`;

    // State
    panelVisible = false; // empty | active
    loading = false;
    composerOpen = false;
    responsesCache;
    counter = 1;
    actionsLoaded = false;

    // Config Properties
    config;
    user;
    suggestAction1 = {
        label: null,
        value: null
    };
    suggestAction2 = {
        label: null,
        value: null
    };
    resultItem = 1;

    // Data Variables
    responses;
    einsteinGreeting = this.configureMessage("", "", "", this.einsteinGreeting, "greeting", "slds-message result0", "");
    @track messages = [];
    description;
    @track emailBody;
    inputVariables;
    @track flowAPIName;
    flowVisible = false;

    get doesflowAPINameExist() {
        if (this.flowAPIName != null) {
            return this.flowAPIName;
        }
    }
    handleStatusChange(event) {
        if (event.detail.status === 'FINISHED_SCREEN' || event.detail.status === 'FINISHED') {
            // this fires a success toast after the execution of the flow
            this.fireSuccessToast();

            //Hide the Flow again
            this.flowVisible = false;

            console.log('Success!');
        }
        else {
            console.log('Flow execution encountered an unexpected status.');
        }
    }
    fireSuccessToast() {
        const evt = new ShowToastEvent({
            title: 'Success!',
            message: '',
            variant: 'success',
        });
        this.dispatchEvent(evt);
    }

    // Set Static Resources
    einsteinWelcomeImageUrl = einsteinWelcomeImage;
    einsteinWelcomeBGUrl = einsteinWelcomeBG;
    agentforce = SDO_Agentforce_SVG + '#agentforce';

    // Booleans for Rendering
    welcomeContentVisible = true;
    welcomeContentLoading = true;
    messagePanelVisible = false;
    einsteinReplyLoading = false;
    // Private Variables
    suggestAction1 = {
        label: null,
        value: null
    };
    suggestAction2 = {
        label: null,
        value: null
    };

    // Getters
    get getContentHeight() {
        return `height:${this.contentHeight}vh`;
    }
    get isWelcomeContentVisible() {
        return this.welcomeContentVisible;
    }
    get isWelcomeContentLoading() {
        return this.welcomeContentLoading;
    }

    get welcomeBackground() {
        return `background-image: url(${this.einsteinWelcomeBGUrl})`;
    }
    get suggestedAction1Active() {
        return (this.suggestAction1.label && this.suggestAction1.value) ? true : false;
    }
    get suggestedAction2Active() {
        return (this.suggestAction2.label && this.suggestAction2.value) ? true : false;
    }
    get isMessagePanelVisible() {
        return this.messagePanelVisible;
    }
    get isEinsteinReplyLoading() {
        return this.einsteinReplyLoading;
    }
    get suggestedActionsActive() {
        return (this.suggestedAction1Active || this.suggestedAction2Active) ? true : false;
    }
    get contentClass() {
        if (this.suggestedActionsActive && this.isMessagePanelVisible) {
            // console.log('suggestedActionsActive',this.suggestedActionsActive);
            // if (this.isMessagePanelVisible && this.isWelcomeContentVisible) {

            //     console.log('isMessagePanelVisible',this.isMessagePanelVisible);
            //     console.log('isWelcomeContentVisible',this.isWelcomeContentVisible);
            //     return 'content content-height_max';
            // } else {

            //     console.log('else:isMessagePanelVisible',this.isMessagePanelVisible);
            //     console.log('else:isWelcomeContentVisible',this.isWelcomeContentVisible);
            //     return 'content content-height_min';
            // }
            return 'content content-height_max';
        } else {

            console.log('suggestedActionsInActive', this.suggestedActionsActive);
            return 'content content-height_min';
        }
    }
    // Message Handlers

    handleInputCommit(event) {
        var key = event.keyCode;
        // If the user has pressed enter
        if (key === 13 && !event.shiftKey) {
            event.preventDefault();
            const keyword = event.target.value;
            this.processMessage();

        }
    }

    handleCommit(event) {
        this.processMessage();
    }

    async suggestedActionClick(event) {
        const actionLabel = event.currentTarget.dataset.label;
        // console.log('label', actionLabel);
        const replyId = event.currentTarget.dataset.value;

        // console.log('value', replyId);
        await this.getData();
        const response = this.responses.find((item) => item.id === replyId);
        let message = this.configureMessage(this.user?.SmallPhotoUrl, 'Selected \"' + actionLabel + '\"', null, "", "question", "slds-message result" + this.resultItem, '');
        this.messages.push(message);

        console.log('this.welcomeContentLoading 1', this.welcomeContentLoading);
        // Show Welcome Panel
        this.welcomeContentLoading = true;
        // // Show Loading Panel
        // this.welcomeContentVisible = true;
        // this.panelVisible = true;
        this.resultItem++;
        console.log('this.welcomeContentLoading 2', this.welcomeContentLoading);
        if (this.resultItem == 2) {
            setTimeout(() => {
                this.welcomeContentVisible = false;
            }, 700);
            setTimeout(() => {
                // Show Message Panel 
                this.messagePanelVisible = true;
            }, 1000);
            setTimeout(() => {
                this.getAnswer(response.keyword);
            }, 1500);
        } else {
            this.getAnswer(response.keyword);
        }

        const dataset = {
            domEvent: event.type,
            version: this.VERSION,
            type: 'reporting',
            event: 'conversion',
            action: 'Einstein Co Pilot Suggested Action',
            minutesSaved: 1.5,
            value: actionLabel
        };

        this.trackEvent(dataset);
    }

    processMessage() {
        const textarea = this.template.querySelector(".einstein-text-area");
        const keyword = textarea.value;
        let message = this.configureMessage(this.user?.SmallPhotoUrl, keyword, null, "", "question", "slds-message result" + this.resultItem, '');
        this.messages.push(message);
        // Hide Welcome Panel
        this.welcomeContentLoading = false;

        this.welcomeContentVisible = false;
        this.messagePanelVisible = true;
        // this.panelVisible = true;
        this.resultItem++;
        // if (this.resultItem == 2) {
        //     setTimeout(() => {
        //         this.welcomeContentVisible = false;
        //     }, 700);
        //     setTimeout(() => {
        //         // Show Message Panel 
        //         this.messagePanelVisible = true;
        //     }, 1000);
        //     setTimeout(() => {
        //         this.getAnswer(keyword);
        //     }, 1500);
        // } else {
        //     this.getAnswer(keyword);
        // }

        this.getAnswer(keyword);
        textarea.value = '';
    }

    configureMessage(avatar = einsteinAvatarResourceIcon, question, response, responseText, type, itemClass, title) {

        let message = {
            i: this.counter++,
            avatar: avatar,
            question: question,
            response: response,
            responseText: responseText,
            type: type,
            class: itemClass,
            title: title
        };
        return message;
    }

    getAction(value) {
        let message = this.messages.slice(-1)[0];
        let responseAction = message.response.Actions.find((action) => action.Name === value);
        return responseAction;
    }

    convertToText(str) {
        if ((str === null) || (str === '')) {
            return false;
        } else {
            str = str.toString();
        }

        str = str.replace(/(<([^>]+)>)/ig, '');
        str = str.replace(/&quot;/g, "\"");
        str = str.replace(/&#39;/g, "\'");
        str = str.replace(/&amp;/g, "&");
        return str;
    }

    // Message Scroll Handlers
    handleMessageTyping = () => {
        setTimeout(() => {
            let lastResultIndex = this.resultItem - 1;
            let lastItemClass = '.slds-message.result' + lastResultIndex;
            console.log('lastItemClass', lastItemClass);
            let resultSelector = this.template.querySelector(lastItemClass);
            console.log('resultSelector', resultSelector);
            if (resultSelector) {
                resultSelector.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
                // console.log('scrollToBottom', resultSelector);
                // this.scrollToBottom(resultSelector);
            }
        }, 50);
    };

    scrollToBottom(element) {
        element.scroll({ top: element.scrollHeight, behavior: 'smooth' });
    }

    // Action Handler
    handleMessageAction = (event) => {
        try {
            let action = event.detail;
            switch (action.type) {
                case "Einstein Message":
                    this.getAnswer(action.NextMessageKeyword__c);
                    break;
                case "Copy to Clipboard":
                    if (navigator.clipboard) {
                        const blobHtml = new Blob([action.message], { type: 'text/html' });
                        const plainText = this.convertToText(action.message);
                        const blobText = new Blob([plainText], { type: 'text/plain' });
                        const clipboardItemInput = new ClipboardItem({
                            "text/plain": blobText,
                            "text/html": blobHtml,
                        });
                        navigator.clipboard.write([clipboardItemInput]);
                    }
                    break;
                case "Email Composer":
                    let email = {
                        to: action.emailTo,
                        subject: action.emailSubject,
                        body: action.emailBody
                    };
                    this.emailBody = email;
                    break;
                case "View":
                    const viewRef = {
                        type: "standard__recordPage",
                        attributes: {
                            recordId: action.targetRecordId,
                            actionName: "view"
                        }
                    };
                    this[NavigationMixin.Navigate](viewRef);
                    break;
                case "Edit Record":
                    const editRef = {
                        type: "standard__recordPage",
                        attributes: {
                            recordId: action.targetRecordId,
                            actionName: "edit"
                        }
                    };
                    this[NavigationMixin.Navigate](editRef);
                    break;
                case "Launch Flow":
                    if (!action.targetRecordId) {
                        this.inputVariables = [
                            {
                                name: 'recordId',
                                type: 'String',
                                value: this.recordId
                            }
                        ];
                    } else {
                        this.inputVariables = [
                            {
                                name: 'recordId',
                                type: 'String',
                                value: action.targetRecordId
                            }
                        ];
                    }

                    console.log('inputvariables', JSON.parse(JSON.stringify(this.inputVariables)));
                    this.flowAPIName = action.flowAPIName;
                    this.flowVisible = true;
                    break;
                case "Open URL":
                    const urlRef = {
                        type: 'standard__webPage',
                        attributes: {
                            url: action.url
                        }
                    };
                    this[NavigationMixin.Navigate](urlRef);
                    break;
                case "Toggle Next Reply":
                    let nextResponse = this.responses.find((item) => item.id == action.nextReplyId);
                    this.getAnswer(nextResponse.keyword);
                    break;
                case "Field Update":
                    updateField({ recordId: action.targetRecordId, fieldNameToUpdate: action.targetFieldApiName, updateWith: action.updateWith })
                        .then(result => {
                            if (result) {
                                updateRecord({ fields: { Id: this.recordId } })
                            }
                        })
                        .catch(error => {
                            console.error('Error calling Apex method:', error);
                        });
                    break;
                default:
                    console.log(`Action not found: ${action.Name} / ${action.ActionTarget__c}.`);
            }
        } catch (error) {
            console.log('egptSidebar Error Log:' + error);
        }
    };

    // Apex Functions
    async getAnswer(keyword) {
        this.einsteinReplyLoading = true;
        await this.getData();

        const response = this.responses.find((item) => keyword.toLowerCase().includes(item.keyword.toLowerCase()));
        const wait = 6000;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.einsteinReplyLoading = false;
            let message;
            if (response) {
                message = this.configureMessage(this.user?.SmallPhotoUrl, "", response, response.message, "answer", "slds-message result" + this.resultItem, response.title);
                this.messages.push(message);

            } else {
                // console.log('')
                message = this.configureMessage(
                    this.user?.SmallPhotoUrl,
                    "",
                    null,
                    this.config.Unknown_Answer_Fallback__c,
                    "unknown", "slds-message result" + this.resultItem, ''
                );
                this.messages.push(message);
            }
            this.resultItem++;
        }, wait);
    }

    async getData() {
        try {
            this.responses = await fetchSimulatedData({
                'einsteinConfigurationId': this.gptConfiguration
            });

        } catch (e) {
            this.error = `>>>>> Error executing getData with ${e.message}`;
        }
    }


    @api gptConfiguration;
    @wire(getGPTConfiguration, { configurationId: '$gptConfiguration' })
    wiredRecordMethod({ error, data }) {
        if (data) {
            this.config = data;
            this.suggestAction1 = {
                label: this.config.Suggested_Action_1_Label__c,
                value: this.config.Suggested_Action_1__c
            }
            this.suggestAction2 = {
                label: this.config.Suggested_Action_2_Label__c,
                value: this.config.Suggested_Action_2__c
            }
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.config = undefined;
        }
    }

    getUser() {
        getUserDetails()
            .then((result) => {
                this.user = result;
            })
            .catch((error) => {
                console.log("Error: ", error);
            });
    }

    // Component Lifecycle Functions
    connectedCallback() {
        this.componentName = this.COMPONENT_NAME;
        super.connectedCallback();

        setTimeout(() => {
            this.welcomeContentLoading = false;
        }, 2000);
        this.addEventListeners();
        this.getUser();
    }
    renderedCallback() {
        if (!this.hasRendered) {
            window.setTimeout(this.registerTrackingHandlers.bind(this), this.HANDLER_REGISTRATION_DELAY);
            this.hasRendered = true;
        }


        console.log('Einstein Copilot Simulator Rendered');
    }
    addEventListeners() {
        window.addEventListener("egpt_togglepannel", this.openSidebar, false);
        window.addEventListener("egpt_messageaction", this.handleMessageAction, false);
        window.addEventListener("egpt_messagetyping", this.handleMessageTyping, false);
    }
    disconnectedCallback() {
        window.removeEventListener("openeinstein", this.handleMessage, false);
        window.removeEventListener("messageaction", this.handleMessage, false);
    }
}