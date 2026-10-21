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
import einsteinAvatarResourceIcon from '@salesforce/resourceUrl/SDOSalesGptAvatarIcon';
import einsteinWelcomeImage from '@salesforce/resourceUrl/SDOEinsteinWelcomeImage';
import einsteinWelcomeBG from '@salesforce/resourceUrl/SDOEinsteinWelcomeBG';
import SDO_Agentforce_SVG from '@salesforce/resourceUrl/SDO_Agentforce_SVG';

import hideCopilotCss from '@salesforce/resourceUrl/HideCopilotCss';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';

import { nanoId } from 'c/xdoToolCommonJs'
import XdoToolTrackingEventHandlerBase from 'c/xdoToolTrackingEventHandlerBase';
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class SdoSalesGptAssistant extends XdoToolTrackingEventHandlerBase {
	COMPONENT_NAME = 'SdoSalesGptAssistant';
	HANDLER_REGISTRATION_DELAY = 100;
	VERSION = 'v1';
	NANOID = nanoId();


	agentforce = SDO_Agentforce_SVG + '#agentforce';

	// ****** Props ******
	@api mobileMode;
	@api recordId
	@api overlayMode = false;
	@api overlayHidden = false;
	@api hiddenDefault = false;
	@api headerDarkMode = false;
	@api containerClass = 'container';
	@api panelToggleIconClass = 'utility:right';
	@api einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconActive';
	@api contentHeight = 0;
	@api contentUpdateIsRunning = false;
	@api resultItem = 1;
	@api widthPercent = 30;
	@api headerTitle = 'Agentforce';
	@api einsteinGreeting = 'Hi! Agentforce can do things like search for information, summarize records, and draft and revise emails. What do you want to do today?';
	overlayWidth = `width: ${this.widthPercent}vW;`;
	@track rightOffset = 290;
	einsteinWelcomeImageUrl = einsteinWelcomeImage;
	einsteinWelcomeBGUrl = einsteinWelcomeBG;

	// State
	panelVisible = false; // empty | active
	_loading = false;
	composerOpen = false;
	responsesCache;
	counter = 1;
	welcomeVisible = false;
	welcomeLoading = true;
	// Config
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
	@api height;

	@api gptConfiguration;
	// Data
	responses;
	einsteinGreeting = this.configureMessage("", "", "", this.einsteinGreeting, "greeting", "slds-size_1-of-1 result0", "");
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

	get iconStyling() {
		return `right: ${this.rightOffset}px;`;
	}
	get welcomeBackground() {
		return `background-image: url(${this.einsteinWelcomeBGUrl})`;
	}

	set loading(value) {
		const SCROLL_CLASS = "slds-scrollable";
		let messageContainer = this.template.querySelector("div.message-container");

		if (messageContainer) {
			if (value) {
				messageContainer.classList.remove(SCROLL_CLASS);
			}
			else {
				messageContainer.classList.add(SCROLL_CLASS);
			}
		}

		this._loading = value;
	}

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

	get dynamicFooterClass() {
		return (this.suggestAction1.label || this.suggestAction2.label) ? 'content content-height_max' : 'content content-height_min';
	}

	get showSuggestedAction1() {
		return this.suggestAction1.label != null;
	}

	get showSuggestedAction2() {
		return this.suggestAction2.label != null;
	}

	async suggestedActionClick(event) {
		const actionLabel = event.currentTarget.dataset.label;
		// console.log('label', actionLabel);
		const replyId = event.currentTarget.dataset.value;

		// console.log('value', replyId);
		await this.getData();
		const response = this.responses.find((item) => item.id === replyId);
		let message = this.configureMessage(this.user?.SmallPhotoUrl, 'Selected \"' + actionLabel + '\"', null, "", "question", "slds-size_1-of-1 result" + this.resultItem, '');
		this.messages.push(message);

		this.panelVisible = true;
		this.welcomeVisible = false;
		this.resultItem++;
		// console.log('resultItem',this.resultItem);
		if (this.resultItem == 2) {
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



	// ****** Starting State ******

	connectedCallback() {
		this.componentName = this.COMPONENT_NAME;
		super.connectedCallback();

		loadStyle(this, hideCopilotCss).then(() => {
			//console.log('css loaded');
		});
		// this.panelVisible = false;
		this.fixIcons('connectedCallback');


		if (this.hiddenDefault == true) {

			this.welcomeVisible = false;
			this.welcomeLoading = true;
			this.overlayHidden = true;
			this.panelToggleIconClass = 'utility:left';
			this.overlayWidth = 'width: 10px; overflow: hidden;';
			if (this.headerDarkMode == true) {
				this.einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconInverse';
			}
		} else {
			this.welcomeLoading = true;
			this.welcomeVisible = true;
			this.overlayWidth = `width: ${this.widthPercent}vW;`;
			setTimeout(() => {
				this.welcomeLoading = false;
			}, 1000);
		}

		if (this.overlayMode == true) {
			this.containerClass = 'containerfixed';
		} else {
			this.overlayWidth = "width:-webkit-fill-available;height:" + this.height + "px;margin-right: 10px;";
			this.welcomeLoading = true;
			this.welcomeVisible = true;
			setTimeout(() => {
				this.welcomeLoading = false;
			}, 1000);
		}
		this.addEventListeners();
		// this.getConfig();
		this.getUser();
	}

	renderedCallback() {
		if (!this.hasRendered) {
			window.setTimeout(this.registerTrackingHandlers.bind(this), this.HANDLER_REGISTRATION_DELAY);
			this.hasRendered = true;
		}

		if (this.mobileMode) this.panelVisible = true;
		console.log('Einstein Copilot Simulator Rendered');

		this.fixIcons('renderedCallback');
	}

	fixIcons(callbackName) {

		var einsteinIcons = document.getElementsByClassName('einsteinAssistant');
		//console.log('einsteinIcons',einsteinIcons);
		if (einsteinIcons.length > 0) {
			// console.log(callbackName + ' icon element',einsteinIcons[0]);
			einsteinIcons[0].style = 'display:none;';
		}
		var navbarMenuItems = document.getElementsByClassName('button-container-a11y');
		if (navbarMenuItems.length > 0) {
			var navbarMenuWidth = navbarMenuItems[0].offsetWidth;
			// console.log(callbackName + ' nav width',navbarMenuWidth); //Outputs 332px
			this.rightOffset = navbarMenuWidth;
		}
	}

	toggleOverlay(event) {
		if (this.overlayHidden == false) {
			this.overlayHidden = true;
			this.panelVisible = false;

			this.welcomeVisible = false;
			this.panelToggleIconClass = 'utility:left';
			this.overlayWidth = 'width: 10px; overflow: hidden;';
			if (this.headerDarkMode == true) {
				this.einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconInverse';
			} else {
				this.einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconInactive';
			}
		} else {
			this.overlayHidden = false;
			// this.panelVisible = true;
			this.welcomeLoading = true;
			this.welcomeVisible = true;
			this.messages = [];
			this.resultItem = 1;
			this.panelToggleIconClass = 'utility:right';
			this.overlayWidth = `width: ${this.widthPercent}vW;`;
			setTimeout(() => {
				this.welcomeLoading = false;
			}, 1000);
			if (this.headerDarkMode == true) {
				this.einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconActiveInverse';
			} else {
				this.einsteinMenuIconClass = 'einstein-menu-icon einsteinMenuIconActive';
			}
		}
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

	handleMessageTyping = () => {
		// eslint-disable-next-line @lwc/lwc/no-async-operation
		if (this.overlayMode == true) {
			setTimeout(() => {
				let lastResultIndex = this.resultItem - 1;
				let resultSelector = this.template.querySelector('.result' + lastResultIndex);
				// console.log('Typing', resultSelector);
				if (resultSelector) {
					resultSelector.scrollIntoView(true);
				}
			}, 50);
		}
	};

	handleMessageAction = (event) => {
		try {
			let action = event.detail;
			// console.log('action', action);
			switch (action.type) {
				case "Einstein Message":
					this.getAnswer(action.NextMessageKeyword__c);
					break;
				case "Copy to Clipboard":
					// console.log('action message', action.message);
					if (navigator.clipboard) {
						const blobHtml = new Blob([action.message], { type: 'text/html' });
						// console.log('blob', blobHtml);
						const plainText = this.convertToText(action.message);
						// console.log('plainText', plainText);
						const blobText = new Blob([plainText], { type: 'text/plain' });
						// console.log('blobText', blobText);
						const clipboardItemInput = new ClipboardItem({
							"text/plain": blobText,
							"text/html": blobHtml,
						});
						// console.log('clipboardItemInput', clipboardItemInput);
						navigator.clipboard.write([clipboardItemInput]);
						// navigator.clipboard.writeText(action.message);
						// console.log('Copied');
					}
					// let elementClass = '.' + action.class.split(' ').join('.') + ' div.copy-me lightning-formatted-rich-text.slds-rich-text-editor__output';
					// console.log('elementClass', elementClass);
					// let selectedElement = this.template.querySelector(elementClass);
					// console.log('selectedElement', JSON.stringify(selectedElement));
					// selectedElement.select();
					// selectedElement.setSelectionRange(0,9999999);
					// document.execCommand('copy');
					break;
				case "Email Composer":
					// console.log('email action', action);
					let email = {
						to: action.emailTo,
						subject: action.emailSubject,
						body: action.emailBody
					};
					// console.log('email action', JSON.stringify(email));
					this.emailBody = email;
					break;
				case "View":
					// console.log('view');
					const viewRef = {
						type: "standard__recordPage",
						attributes: {
							recordId: action.targetRecordId,
							// objectApiName: action.recordApiName,
							actionName: "view"
						}
					};
					this[NavigationMixin.Navigate](viewRef);
					break;
				case "Edit Record":
					// console.log('edit');
					const editRef = {
						type: "standard__recordPage",
						attributes: {
							recordId: action.targetRecordId,
							// objectApiName: action.recordApiName,
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
					// console.log('URL');
					// console.log('URL', JSON.stringify(action));
					const urlRef = {
						type: 'standard__webPage',
						attributes: {
							url: action.url
						}
					};
					this[NavigationMixin.Navigate](urlRef);
					break;
				case "Toggle Next Reply":
					// console.log('Toggle next reply');
					let nextResponse = this.responses.find((item) => item.id == action.nextReplyId);

					// console.log('next response', nextResponse);
					this.getAnswer(nextResponse.keyword);
					break;
				case "Field Update":
					// console.log('Field Update Action', action);
					updateField({
						recordId: action.targetRecordId,
						fieldNameToUpdate: action.targetFieldApiName,
						updateWith: action.updateWith
					})
						.then(result => {
							if (result) {
								// Refresh Record Detail Page
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


	// handleFlowStatusChange(event) {
	//     console.log('flow event', event);
	// }

	convertToText(str) {
		if ((str === null) || (str === ''))
			return false;
		else
			str = str.toString();

		// Regular expression to identify HTML tags in
		// the input string. Replacing the identified
		// HTML tag with a null string.
		str = str.replace(/(<([^>]+)>)/ig, '');
		str = str.replace(/&quot;/g, "\"");
		str = str.replace(/&#39;/g, "\'");
		str = str.replace(/&amp;/g, "&");
		return str;
	}

	getAction(value) {
		let message = this.messages.slice(-1)[0];
		let responseAction = message.response.Actions.find((action) => action.Name === value);
		return responseAction;
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

	// ****** Message Handling ******

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

	processMessage() {
		const textarea = this.template.querySelector(".einstein-text-area");
		const keyword = textarea.value;
		let message = this.configureMessage(this.user?.SmallPhotoUrl, keyword, null, "", "question", "slds-size_1-of-1 result" + this.resultItem, '');
		this.messages.push(message);
		this.panelVisible = true;
		this.resultItem++;

		this.welcomeVisible = false;
		// console.log('resultItem',this.resultItem);
		if (this.resultItem == 2) {
			setTimeout(() => {
				// console.log('resultItem',this.resultItem);
				this.getAnswer(keyword);
			}, 1500);
		} else {
			this.getAnswer(keyword);
		}
		// this.getAnswer(keyword);
		textarea.value = '';
	}

	async getAnswer(keyword) {
		this.loading = true;
		// this.toggleContainerScroll();

		await this.getData();

		const response = this.responses.find((item) => keyword.toLowerCase().includes(item.keyword.toLowerCase()));
		const wait = 6000;
		// eslint-disable-next-line @lwc/lwc/no-async-operation
		setTimeout(() => {
			this.loading = false;
			// this.toggleContainerScroll();
			let message;
			if (response) {
				message = this.configureMessage(this.user?.SmallPhotoUrl, "", response, response.message, "answer", "slds-size_1-of-1 result" + this.resultItem, response.title);
				this.messages.push(message);

			} else {
				message = this.configureMessage(
					this.user?.SmallPhotoUrl,
					"",
					null,
					"Sorry, I don't know the answer to that question",
					"unknown", "slds-size_1-of-1 result" + this.resultItem, ''
				);
				this.messages.push(message);
			}
			this.resultItem++;
		}, wait);
	}


	get showMessagePanel() {
		return this.panelVisible;
	}

	get showLoadingPanel() {
		return this._loading;
	}

	get showWelcomePanel() {
		return this.welcomeVisible;
	}

	get showWelcomeLoading() {
		return this.welcomeLoading;
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
}