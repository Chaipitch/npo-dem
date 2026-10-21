({
    /*rerender : function(component, helper) {
        this.superRerender();
        
        console.log('1 - rerender: einsteinIcons');
        helper.fixIcons(component);
        
        console.log('2 - rerender: externalDiv');
        helper.fixNav(component);
    },
    afterRender : function(component, helper) {
        this.superAfterRender();
        
        //console.log('1 - afterrender: einsteinIcons');
        //helper.fixIcons(component);
        
        //console.log('2 - afterrender: externalDiv');
        //helper.fixNav(component);
    },*/
    render : function(component, helper) {
       var ret = this.superRender();
        
        //console.log('1 - render: einsteinIcons');
        //helper.fixIcons(component);
        
        //console.log('2 - render: externalDiv');
        helper.fixNav(component);
        
        return ret;
    }
})