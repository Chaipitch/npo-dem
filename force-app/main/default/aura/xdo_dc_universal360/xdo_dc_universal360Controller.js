({
    doInit : function(component, event, helper) {
        helper.setBackground(component);
        helper.getRecords(component);

    },

    doRefresh:function(component, event, helper) {

        helper.setBackground(component);
        helper.getRecords(component);
        var toastEvent = $A.get("e.force:showToast");
        toastEvent.setParams({
        "title": "Success!",
        "message": "The universal config has been added/updated successfully.",
        "type":"success"
        });
    toastEvent.fire();

    },

    redirectToURL: function(component, event, helper) {

        let uId = component.get("v.uId");
        console.log(uId);

        var navEvt = $A.get("e.force:navigateToSObject");
        navEvt.setParams({
             "recordId": uId,
             "slideDevName": "related"
        });
        navEvt.fire();

    },

    onRender: function(component, event, helper){

        const isLoaded = component.get('v.isLoaded');
        
        if(!isLoaded){
        const CONSTANTS = component.get('v.xdoToolTrackingEventConstants');
        const dataset = {
            domEvent: 'Load',
            version: CONSTANTS.VERSION,
            type: 'reporting',
            event: 'conversion',
            action: 'Data Cloud 360 Profile View',
            minutesSaved: 1,
            value: ''
        };

        component.find('xdoToolTrackingEventHandler')
        .track(CONSTANTS.COMPONENT_NAME, dataset);
        component.set('v.isLoaded', true);
        console.log("Track Event Published!");
    }

    },
    openModal: function(component, event, helper) {
        var modal = component.find("modal");
        var backdrop = component.find("backdrop");

        var flow = component.find("flowData");

        var inputVariables = [
            {
                name : "recordId",
                type : "String",
                value : component.get('v.recordId')
            }
        ];
        //Reference flow's Unique Name
        flow.startFlow("xdo_dc_Universal_360_Add_Modify_Flow", inputVariables);

        $A.util.addClass(modal, "slds-fade-in-open");
        $A.util.addClass(backdrop, "slds-backdrop_open");
    },
    closeModal: function(component, event, helper) {

        var modal = component.find("modal");
        var backdrop = component.find("backdrop");
        $A.util.removeClass(modal, "slds-fade-in-open");
        $A.util.removeClass(backdrop, "slds-backdrop_open");
        
        helper.getRecords(component);
    },
    submit: function(component, event, helper) {

        console.log('SAVE RECORD');
        
        var flow = component.find("flowData");
        var nextButton = flow.getElement().querySelector(".slds-button.slds-button_brand");
            // Trigger the click event of the "Next" button
            if (nextButton) {
                nextButton.click();
                window.setTimeout(()=>{
                    var modal = component.find("modal");
                    var backdrop = component.find("backdrop");
                    $A.util.removeClass(modal, "slds-fade-in-open");
                    $A.util.removeClass(backdrop, "slds-backdrop_open");
                    
                    $A.get('e.force:refreshView').fire();

                }, 1000);
                
            } else {
                console.log("Next button not found.");
            }
    }

})