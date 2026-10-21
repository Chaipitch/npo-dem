({
    handleUpdate : function(component, event, helper) {
        component.set("v.isProcessing", true);
        component.set("v.message", "Processing...");
        component.set("v.messageType", "info");
        
        var action = component.get("c.updateRecords");
        
        action.setCallback(this, function(response) {
            var state = response.getState();
            
            if (state === "SUCCESS") {
                var result = response.getReturnValue();
                component.set("v.message", "Success! " + result);
                component.set("v.messageType", "success");
                component.set("v.isProcessing", false);
                component.set("v.isComplete", true);
                
            } else if (state === "ERROR") {
                var errors = response.getError();
                var message = 'Unknown error';
                if (errors && errors[0] && errors[0].message) {
                    message = errors[0].message;
                }
                component.set("v.message", "Error: " + message);
                component.set("v.messageType", "error");
                component.set("v.isProcessing", false);
            }
        });
        
        $A.enqueueAction(action);
    },
    
    handleCancel : function(component, event, helper) {
        $A.get("e.force:closeQuickAction").fire();
    },
    
    handleFinished : function(component, event, helper) {
        $A.get("e.force:closeQuickAction").fire();
    }
})