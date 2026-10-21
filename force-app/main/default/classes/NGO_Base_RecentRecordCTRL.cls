public class NGO_Base_RecentRecordCTRL {
    public String demoStory {get; set;}
    
    public static void runEmployment() {
        
        getMetadata('Employment');
    }

        public static void runCrisisSupport() {
        
        getMetadata('Crisis & Trauma Support');
    }
    
    public static void getMetadata(String demoStory) {
        NGO_IDO_Personas__mdt[] personaList = [SELECT External_Id__c, Id, Name_of_Record__c, Sort_Order__c, Target_Type__c FROM NGO_IDO_Personas__mdt WHERE Demo_Story__c =: demoStory];
    	String favQuery = '';
        String recAccQuery = '';
        Account acc = new Account();
        ListView lv = new ListView();
        for (NGO_IDO_Personas__mdt a : personaList) {
            if (a.Target_Type__c == 'Record') {
                acc = [SELECT Id, Name FROM Account WHERE External_Id__c =: a.External_Id__c];
              //  User commUser = [SELECT id, ContactId, Contact.AccountId, External_Id__c FROM User WHERE Contact.AccountId =: acc.Id LIMIT 1]; 
              // commUser.External_Id__c = 'User.HeroPersona';
              //  update commUser;
            } else if (a.Target_Type__c == 'ListView') {
                System.debug('Adding a ListView is coming soon!');
            }
            favQuery = favQuery + '{"name": "'+a.Name_of_Record__c + '", "sortOrder": '+ a.Sort_Order__c +', "target": "'+acc.Id +'", "targetType": "Record"}';
        	recAccQuery = 'SELECT+Id+FROM+ACCOUNT+WHERE+Id=\''+acc.Id+'\'+FOR+VIEW';
        }
        setFavorites(favQuery);
        setRecentAccounts(recAccQuery);


    }
    
          public static PageReference redirect(){
            PageReference pageRef = new PageReference('/lightning/n/qbranch__Demo_Wizard');
            return pageRef;
        }


    
    public static void setRecentAccounts(String fullQuery) {
        HttpRequest req = new HttpRequest();
        HttpResponse res = new HttpResponse();
        Http http = new Http();
        String baseURL = URL.getOrgDomainUrl().toExternalForm();
        
        //req.setEndpoint('https://br-ngotso013123.my.salesforce.com/services/data/v59.0/query/?q=SELECT+Name+FROM+Account+LIMIT+1+FOR+VIEW');
        req.setEndpoint(baseURL + '/services/data/v59.0/query/?q='+fullQuery);
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        
        try {
            res = http.send(req);
            System.debug(res.getBody());
        } catch (System.CalloutException e) {
            System.debug('Callout error: ' + e);
        }
    }
    
        public static void setFavorites(String fullQuery) {
        HttpRequest req = new HttpRequest();
        HttpResponse res = new HttpResponse();
        Http http = new Http();
        String baseURL = URL.getOrgDomainUrl().toExternalForm();

            
        req.setEndpoint(baseURL + '/services/data/v59.0/ui-api/favorites/');
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer '+ UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');
        req.setBody(fullQuery);

        try {
            res = http.send(req);
            System.debug(res.getBody());
        } catch (System.CalloutException e) {
            System.debug('Callout error: ' + e);
        }
    }
    
}