({
    sendEvent : function (cmp, eventType) {
		var conversationId = cmp.get("v.recordId");
        console.log("Sending Event with Id " + conversationId);
        window.setTimeout(
            $A.getCallback ( function() {
                let objEvent = $A.get("e.c:AIAgentMonitorEvent");
                objEvent.setParams({
                    conversationId : conversationId,
                    messageType : eventType
                });
                objEvent.fire();
            }), 100);
    },
    
    setupDemoResponses : function(cmp) {
        // Setup what should be sent back and forth to mock a conversation
        var responses = cmp.get("v.demoCustomerResponses");
        responses.push(
        {
            Entry_Time__c: Date.now(),
            Type__c: 'Speech',
            Transcript__c: 'That’s exactly what I need! How does the AI work?',
            Translation__c: 'C’est exactement ce qu’il me faut ! Comment fonctionne l’IA ?',
            Spoken_By__c: 'Customer',
            id: '',
            Name: 'name1',
            MetadataText__c: 'Craig • 12:29PM • Translated from English'
        });
    },
    
    sendDemoResponse : function(cmp) {
        // Used to mock a conversation happening with the demo customer.
        console.log("Sending Demo Response");
        var responses = cmp.get("v.demoCustomerResponses");
        if (responses.length > 0) {
            window.setTimeout(
                $A.getCallback(function() {
                    var response = cmp.get("v.demoCustomerResponses").shift(); // Gets and removes first element
                    console.log("Sending Demo Response: " + response.Transcript__c);
                    var conversationEntries = cmp.get("v.conversationEntries");
                    conversationEntries.push(response);
                    cmp.set("v.conversationEntries", conversationEntries);
                }), 3000
            );
        }
    }
    
})