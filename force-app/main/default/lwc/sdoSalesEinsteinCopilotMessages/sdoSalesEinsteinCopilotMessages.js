import { LightningElement, api, track } from 'lwc';
import einsteinAvatarResource from '@salesforce/resourceUrl/SDOSalesGptAvatar';


export default class SdoSalesEinsteinCopilotMessages extends LightningElement {
    einsteinAvatar = einsteinAvatarResource;
    @track _message;
    wordCount = 0;
    typedAnswer = '';
    typing = true;
    @api
    get message() {
        return this._message;
    }
    set message(value) {
        this._message = value;
        if (value) {
            this.type = value.type;
            // if (this.type === 'answer' || this.type === 'unknown') {
            //     this.typeMessage(value.responseText);
            // }
            //console.log('bott message',JSON.stringify(this._message));
        }
    }

    //This Function is not getting called when the profile image doesn't exist.
    fallbackImage(event){
        // console.log('img',JSON.stringify(event.target.src));
        event.target.src = '/_slds/images/profile_avatar_96.png?cache=3c01f25f';
    }
    typeMessage(value) {
        let speed = 15;
        let words = value.split(' ');
        if (this.wordCount < words.length) {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                this.typedAnswer += words[this.wordCount] + ' ';
                this.notifyParentTyping();
                this.wordCount++;
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => {
                    this.typeMessage(value);
                }, speed);
            }, 25);
        } else {
            this.wordCount = 0;
            this.typing = false;
            this.notifyParentTyping();
        }
    }

    notifyParentTyping() {
        let event = new CustomEvent('egpt_messagetyping', {
            detail: {
                value: true
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    handleAction(event) {
        event.preventDefault();
        event.stopPropagation();
        let messageClone = JSON.parse(JSON.stringify(this._message));
        let selectedAction;
        let actionType = event.currentTarget.dataset.type;
        // console.log('actionType', actionType);
        if (actionType === 'card-action') {
            // console.log('message',JSON.parse(JSON.stringify(messageClone)));
            let cardId = event.currentTarget.dataset.cardid;
            let actionId = event.currentTarget.dataset.actionid;
            messageClone.response.cards.forEach((card) => {
                if (card.id === cardId) {
                    card.actions.forEach((action) => {
                        // console.log('cards', action);
                        if (action.id === actionId) {
                            // action.disabled = true;
                            selectedAction = action;
                        }
                    })
                }
            })
        } else{
            let actionId = event.currentTarget.dataset.actionid;
            // console.log('message',JSON.parse(JSON.stringify(messageClone)));
            // console.log('actionId', actionId);
            messageClone.response.actions.forEach((action) => {
                // console.log('action', action);
                if (action.id === actionId) {
                    // console.log('action', action);
                    // action.disabled = true;
                    selectedAction = action;
                }
            })
        }
        this._message = messageClone;
        // console.log('message',JSON.parse(JSON.stringify(messageClone)));
        let messageAction = {
            detail: {
                id: selectedAction.id,
                targetFieldApiName: selectedAction.targetFieldApiName,
                targetRecordId: selectedAction.targetRecordId,
                type: selectedAction.type,
                updateWith: selectedAction.updateWith,
                recordApiName: selectedAction.recordApiName,
                flowAPIName: selectedAction.flowAPIName,
                url: selectedAction.url,
                nextReplyId: selectedAction.nextReplyId,
                emailTo: selectedAction.emailTo,
                emailSubject: selectedAction.emailSubject,
                emailBody: selectedAction.emailBody,
                message: messageClone.response.message
            },
            bubbles: true,
            composed: true
        }

        if (actionType === 'view-action') {
            messageAction.detail.type = "View";
        }

        let customEvent = new CustomEvent("egpt_messageaction", messageAction);



        this.dispatchEvent(customEvent);
    }

    get showQuestion() {
        return this.type === 'question';
    }

    get showAnswer() {
        return this.type === 'answer' || this.type === 'unknown';
    }

    get showGreeting() {
        this.notifyParentTyping();
        return this.type === 'greeting';
    }

    get unknown() {
        return this.type === 'unknown';
    }

    renderedCallback() {
        this.notifyParentTyping();
    }

    get isMultipleRecType(){
        return this._message.response.messageType === 'Return Multiple Records';
    }
    get isCustomType(){
        return this._message.response.messageType === 'Custom';
    }
    get hasMessageAndTitle(){
        return (this._message.response.message && this._message.response.title);
    }
    get isSingleRecType(){
        return this._message.response.messageType === 'Return Single Record';
    }
    get getFirstActionId() {
        return this._message.response.actions[0].id
    }
}