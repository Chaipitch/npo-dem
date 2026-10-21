({
	doInit : function(component, event, helper) {
        var action = component.get('c.getContact');
        var currentRecord = component.get('v.recordId');
               
        action.setParams( {currentRecord : currentRecord} ); 
        action.setCallback(this, function(response){
                var state = response.getState();
                if (component.isValid() && state === "SUCCESS"){                    
                  component.set("v.contact", response.getReturnValue());
                  console.log(response.getReturnValue());                                   
                } else {
                  console.log("Failed with state" + state);
                }
          })
          $A.enqueueAction(action);      
    }
})