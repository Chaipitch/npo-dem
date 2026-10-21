({
    doInit: function(cmp, evt, helper) {
        
        // french connection START
        var currentDateTime = Date.now();
        cmp.set('v.currentDateTime', currentDateTime);
        //helper.getContactName(cmp, evt);
        var userId = $A.get("$SObjectType.CurrentUser.Id");
        cmp.set("v.agentUserId", userId);
        // french connection END
        
        var recordId = cmp.get('v.recordId');
        var action = cmp.get('c.getConversationEntries');
        action.setCallback(this, function(response) {
            var state = response.getState();
            console.log('Handling response from getConversationEntries');
            console.log(response.getReturnValue());
            cmp.set('v.conversationEntries', response.getReturnValue());
        });
        action.setParams({
            conversationId : recordId
        });
        $A.enqueueAction(action);

        action = cmp.get('c.getConversationDetails');
        action.setCallback(this, function(response) {
            var state = response.getState();
            console.log('Handling response from getConversationDetails');
            var convObj = response.getReturnValue();
            console.log(convObj);
            cmp.set('v.conversationObj', convObj);
            var header = 'Conversation Monitoring';
            if (convObj.Summary__c != null)
            {
                var header = convObj.Summary__c.split('|')[0];
            }
            cmp.set('v.headerText',header);
            cmp.set('v.lowerFlagButtonDisabled', !convObj.Flag__c);
        });
        action.setParams({
            conversationId : recordId
        });
        $A.enqueueAction(action);
                
     	// For future - simulate a back and forth conversation
        //helper.setupDemoResponses(cmp);
        // Reset transfer button - must be enabled if we are initializing
        cmp.set("v.transferButtonDisabled", false);
        cmp.set('v.showAgentLeft', false);
        cmp.set('v.showLoweredFlag', false);
    },
    
    refreshMonitor : function (cmp, evt, helper) {
        if (evt.getParam('messageType') == 'refresh') {
            // Only refresh if different conversation passed
            if (evt.getParam('conversationId') != cmp.get("v.recordId"))
            {
                cmp.set("v.recordId", evt.getParam('conversationId'));
                $A.enqueueAction(cmp.get('c.doInit'));
                // Re-show Conversation Catch up if you refresh the window
                var cmpTarget = cmp.find('convCatchUp');
                $A.util.removeClass(cmpTarget, 'hideSummary');
            }
        }
    },
    
    lowerFlag : function (cmp, evt, helper) {
        console.log("Lower Flag called");
        helper.sendEvent(cmp, 'LowerFlag');
        cmp.set('v.lowerFlagButtonDisabled', true);
        cmp.set('v.showLoweredFlag', true);
        cmp.set('v.lowerFlagTime', new Date());
    },
    
    transfer: function (cmp, evt, helper) {
        console.log("Transfer called");
        helper.sendEvent(cmp, 'Transfer');
        cmp.set("v.transferButtonDisabled", true);
        cmp.set('v.lowerFlagButtonDisabled', true);
        cmp.set('v.showAgentLeft', true);
        cmp.set('v.agentLeftTime', new Date());
	},
    
    hideWindow : function(cmp, evt, helper) {
        console.log("hideWindow called");
        helper.sendEvent(cmp, 'hideWindow');
	},

    onRender: function(cmp, evt, helper) {
        console.log("***************** rerender 2 ******************");
        var scroller = cmp.find("chatScrollerId");
        scroller.scrollTo("bottom",0,0);
    },

    hideSummary : function(cmp,evt,helper) {
        console.log("hideSummary called");
        var cmpTarget = cmp.find('convCatchUp');
        $A.util.addClass(cmpTarget, 'hideSummary');
    }
})