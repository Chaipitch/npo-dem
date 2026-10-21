({
    fixIcons : function(component) {
        // Find the einstein logo by its class name        
        var einsteinIcons = document.querySelector('li.einsteinAssistant');
        //console.log('helper: einsteinIcons',einsteinIcons[0]);
        if (einsteinIcons.length > 0) {
            //console.log('einsteinIcons',einsteinIcons[0]);
            einsteinIcons[0].style = 'display:none;';
        }
    },
    fixNav : function(component, event) {
        // Find the external div by its class name
        var externalDivs = document.getElementsByClassName('button-container-a11y');
        
        // Check if we found any
        if (externalDivs.length > 0) {
            var externalDiv = externalDivs[0]; // Get the first instance if there are multiple
            console.log('helper: externalDiv',externalDiv.offsetWidth);
            var styleRight = 'right: ' + externalDiv.offsetWidth + 'px';
            component.set('v.offsetStyle',styleRight);
            /*var icon =  document.getElementById('einstein-button-icon');
            console.log('icon', icon);
            if (icon) {
                icon.style.right = externalDiv.offsetWidth + 'px';
            }
            var multipleIcons = document.getElementsByClassName('einstein-icon-container');
            if (multipleIcons.length > 0 ){
                for(var i = 0; i < multipleIcons.length; i++) {
                    multipleIcons[i].style.right = externalDiv.offsetWidth + 'px';
                }
            }*/
        } else {
            console.log("No external div found with the specified class.");
        }
    }
})