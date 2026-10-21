({
    setBackground : function(component) {

        let bgcolor = component.get("v.backgroundColor");
        let backgroundStyle = `border-radius: 5px;margin-top:5px;background-color:${bgcolor};`;

        if(component.get("v.overrideBackground")){

            let bgImageURL = component.get("v.overrideBackground");
            backgroundStyle = `background-size: cover !important;border-radius: 5px;margin-top:5px;background: url(${bgImageURL})`;
        }

        component.set("v.cardStyle",backgroundStyle);

        

    },

    getRecords: function(component){
        let inverseflag = component.get('v.inverseIconColors');
        const defaultIcon = `/resource/xdo_dc_c360genie/Icons/type=Service_${inverseflag}.png`;

        var action = component.get("c.getUniversalData");
        var currentRecord = component.get("v.recordId");;

        action.setParams({
            recordId: currentRecord
        });
        action.setCallback(this, function (response) {
            var state = response.getState();
            if (component.isValid() && state === "SUCCESS") {
                console.log('Inside Success!!');
                console.log(response.getReturnValue());

                if(response.getReturnValue().length > 0){
                    let universalObj = response.getReturnValue().at(0);
                    component.set("v.uId", universalObj.Id);
                    let universalDetails = {};
                    universalDetails.Name = universalObj.hasOwnProperty('Name') ? universalObj.Name: 'N/A';
                    universalDetails.Image = universalObj.hasOwnProperty('xdo_dc_Icon_for_Universal_360_Name__c') ? universalObj.xdo_dc_Icon_for_Universal_360_Name__c :'/_slds/images/themes/lightning_lite/lightning_lite_profile_avatar_160.png';

                    universalDetails.Section1 = universalObj.xdo_dc_Section_1_Active__c;
                    universalDetails.Section2 = universalObj.xdo_dc_Section_2_Active__c;
                    universalDetails.Section3 = universalObj.xdo_dc_Section_3_Active__c;
                    universalDetails.Section4 = universalObj.xdo_dc_Section_KPI_Active__c;
                    universalDetails.progressBar1Active = universalObj.xdo_dc_Progress_bar_for_Field_17__c;
                    universalDetails.progressBar2Active = universalObj.xdo_dc_Progress_bar_for_Field_18__c;
                    universalDetails.progressBar3Active = universalObj.xdo_dc_Progress_bar_for_Field_19__c;




                    if(universalObj.hasOwnProperty('xdo_dc_Field_1__c'))
                    {
                        universalDetails.Field1 = {
                            value: universalObj.xdo_dc_Field_1__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_1__c') ? universalObj.xdo_dc_Label_for_Field_1__c : 'Field 1',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_1__c') ? universalObj.xdo_dc_Icon_for_Field_1__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_2_Email__c'))
                    {
                        universalDetails.Field2 = {
                            value: universalObj.xdo_dc_Field_2_Email__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_2_Email__c') ? universalObj.xdo_dc_Label_for_Field_2_Email__c : 'Field 2',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_2_Email__c') ? universalObj.xdo_dc_Icon_for_Field_2_Email__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_3_Phone__c'))
                    {
                        universalDetails.Field3 = {
                            value: universalObj.xdo_dc_Field_3_Phone__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_3_Phone__c') ? universalObj.xdo_dc_Label_for_Field_3_Phone__c : 'Field 3',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_3_Phone__c') ? universalObj.xdo_dc_Icon_for_Field_3_Phone__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_4_Address__c'))
                    {
                        universalDetails.Field4 = {
                            //city_state_value: universalObj.xdo_dc_Field_4_Address__c.city ? universalObj.xdo_dc_Field_4_Address__c.city+', '+universalObj.xdo_dc_Field_4_Address__c.state:universalObj.xdo_dc_Field_4_Address__c.state,
                            state_value:universalObj.xdo_dc_Field_4_Address__c.state,
                            city_value: universalObj.xdo_dc_Field_4_Address__c.city,
                            country_value: universalObj.xdo_dc_Field_4_Address__c.country,
                            street_value:universalObj.xdo_dc_Field_4_Address__c.street,
                            zip_value:universalObj.xdo_dc_Field_4_Address__c.postalCode,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_4_Address__c') ? universalObj.xdo_dc_Label_for_Field_4_Address__c : 'Field 4',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_4_Address__c') ? universalObj.xdo_dc_Icon_for_Field_4_Address__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Header_Subtitle__c'))
                    {
                        universalDetails.HeaderSubtitle =  universalObj.xdo_dc_Header_Subtitle__c;
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_5__c'))
                    {
                        universalDetails.Field5 = {
                            value: universalObj.xdo_dc_Field_5__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_5__c') ? universalObj.xdo_dc_Label_for_Field_5__c : 'Field 5',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_5__c') ? universalObj.xdo_dc_Icon_for_Field_5__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_6_Number__c'))
                    {
                        universalDetails.Field6 = {
                            value: universalObj.xdo_dc_Field_6_Number__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_6_Number__c') ? universalObj.xdo_dc_Label_for_Field_6_Number__c : 'Field 6',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_6_Number__c') ? universalObj.xdo_dc_Icon_for_Field_6_Number__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_7__c'))
                    {
                        universalDetails.Field7 = {
                            value: universalObj.xdo_dc_Field_7__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_7__c') ? universalObj.xdo_dc_Label_for_Field_7__c : 'Field 7',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_7__c') ? universalObj.xdo_dc_Icon_for_Field_7__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_8__c'))
                    {
                        universalDetails.Field8 = {
                            value: universalObj.xdo_dc_Field_8__c,
                            label: universalObj.hasOwnProperty('xdo_Label_for_Field_8__c') ? universalObj.xdo_Label_for_Field_8__c : 'Field 8',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_8__c') ? universalObj.xdo_dc_Icon_for_Field_8__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_9__c'))
                    {
                        universalDetails.Field9 = {
                            value: universalObj.xdo_dc_Field_9__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_9__c') ? universalObj.xdo_dc_Label_for_Field_9__c : 'Field 9',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_9__c') ? universalObj.xdo_dc_Icon_for_Field_9__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_10__c'))
                    {
                        universalDetails.Field10 = {
                            value: universalObj.xdo_dc_Field_10__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_10__c') ? universalObj.xdo_dc_Label_for_Field_10__c : 'Field 10',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_For_Field_10__c') ? universalObj.xdo_dc_Icon_For_Field_10__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_11__c'))
                    {
                        universalDetails.Field11 = {
                            value: universalObj.xdo_dc_Field_11__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_11__c') ? universalObj.xdo_dc_Label_for_Field_11__c : 'Field 11',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_11__c') ? universalObj.xdo_dc_Icon_for_Field_11__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_12__c'))
                    {
                        universalDetails.Field12 = {
                            value: universalObj.xdo_dc_Field_12__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_12__c') ? universalObj.xdo_dc_Label_for_Field_12__c : 'Field 11',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_12__c') ? universalObj.xdo_dc_Icon_for_Field_12__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_13__c'))
                    {
                        universalDetails.Field13 = {
                            value: universalObj.xdo_dc_Field_13__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_13__c') ? universalObj.xdo_dc_Label_for_Field_13__c : 'Field 13',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_13__c') ? universalObj.xdo_dc_Icon_for_Field_13__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    if(universalObj.hasOwnProperty('xdo_dc_Field_14__c'))
                    {
                        universalDetails.Field14 = {
                            value: universalObj.xdo_dc_Field_14__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_14__c') ? universalObj.xdo_dc_Label_for_Field_14__c : 'Field 14',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_14__c') ? universalObj.xdo_dc_Icon_for_Field_14__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_15_Image__c'))
                    {
                        universalDetails.Field15Image = universalObj.xdo_dc_Field_15_Image__c;
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_16_Number__c'))
                    {
                        universalDetails.Field16 = {
                            value: universalObj.xdo_dc_Field_16_Number__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_16_Number__c') ? universalObj.xdo_dc_Label_for_Field_16_Number__c : 'Field 16',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_16_Number__c') ? universalObj.xdo_dc_Icon_for_Field_16_Number__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_17_Number__c'))
                    {
                        universalDetails.Field17 = {
                            value: universalObj.xdo_dc_Field_17_Number__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_17__c') ? universalObj.xdo_dc_Label_for_Field_17__c : 'Field 17',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_17__c') ? universalObj.xdo_dc_Icon_for_Field_17__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_18_Number__c'))
                    {
                        universalDetails.Field18 = {
                            value: universalObj.xdo_dc_Field_18_Number__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_18__c') ? universalObj.xdo_dc_Label_for_Field_18__c : 'Field 18',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_18__c') ? universalObj.xdo_dc_Icon_for_Field_18__c +`_${inverseflag}.png` : defaultIcon,
                        }
                    }
                    if(universalObj.hasOwnProperty('xdo_dc_Field_19_Number__c'))
                    {
                        universalDetails.Field19 = {
                            value: universalObj.xdo_dc_Field_19_Number__c,
                            label: universalObj.hasOwnProperty('xdo_dc_Label_for_Field_19__c') ? universalObj.xdo_dc_Label_for_Field_19__c : 'Field 19',
                            icon: universalObj.hasOwnProperty('xdo_dc_Icon_for_Field_19__c') ? universalObj.xdo_dc_Icon_for_Field_19__c+`_${inverseflag}.png`  : defaultIcon,
                        }
                    }

                    let section1Keys = [ 'xdo_dc_Field_1__c', 'xdo_dc_Field_2_Email__c', 'xdo_dc_Field_3_Phone__c', 'xdo_dc_Field_4_Address__c' ];
                    let section2Keys = [ 'xdo_dc_Field_5__c', 'xdo_dc_Field_6_Number__c', 'xdo_dc_Field_8__c', 'xdo_dc_Field_7__c','xdo_dc_Field_9__c' ];
                    let section3Keys = [ 'xdo_dc_Field_10__c', 'xdo_dc_Field_11__c', 'xdo_dc_Field_12__c', 'xdo_dc_Field_13__c','xdo_dc_Field_14__c', 'xdo_dc_Field_15_Image__c' ];
                    let section4Keys = ['xdo_dc_Field_16_Number__c', 'xdo_dc_Field_17_Number__c', 'xdo_dc_Field_18_Number__c','xdo_dc_Field_19_Number__c'];

                    let s1 = section1Keys.some((i)=>{return universalObj.hasOwnProperty(i)});
                    console.log(s1);
                    if(!s1) universalDetails.Section1 = false;

                    let s2 = section2Keys.some((i)=>{return universalObj.hasOwnProperty(i)});
                    console.log(s2);
                    if(!s2) universalDetails.Section2 = false;

                    let s3 = section3Keys.some((i)=>{return universalObj.hasOwnProperty(i)});
                    console.log(s3);
                    if(!s3) universalDetails.Section3 = false;

                    let s4 = section4Keys.some((i)=>{return universalObj.hasOwnProperty(i)});
                    console.log(s4);
                    if(!s4) universalDetails.Section4 = false;

                    
                    component.set("v.universalInfo", universalDetails);
                    component.set("v.displayIllustration", false);
                    component.set("v.flowHeader", "Edit Universal Config");
                    component.set("v.flowButton", "Update Config")
                }
                
                
            }
        });
        $A.enqueueAction(action);
    }

})