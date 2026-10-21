public class NGO_MissionControl_Favorites_Queueable implements Queueable, Database.AllowsCallouts {
    
    public void execute(QueueableContext context) {
        try {
            // Get session ID and base URL
            String sessionId = UserInfo.getSessionId();
            String baseUrl = URL.getOrgDomainUrl().toExternalForm();
            String apiVersion = 'v64.0';
            String endpoint = baseUrl + '/services/data/' + apiVersion + '/ui-api/favorites';
            
            Http http = new Http();
            Integer deletedCount = 0;
            Integer addedCount = 0;
            
            // STEP 1: Delete all existing favorites
            HttpRequest getFavoritesReq = new HttpRequest();
            getFavoritesReq.setEndpoint(endpoint);
            getFavoritesReq.setMethod('GET');
            getFavoritesReq.setHeader('Authorization', 'Bearer ' + sessionId);
            getFavoritesReq.setHeader('Content-Type', 'application/json');
            getFavoritesReq.setTimeout(60000);
            
            HttpResponse getFavoritesRes = http.send(getFavoritesReq);
            
            if (getFavoritesRes.getStatusCode() == 200) {
                Map<String, Object> favoritesResponse = (Map<String, Object>) JSON.deserializeUntyped(getFavoritesRes.getBody());
                List<Object> favorites = (List<Object>) favoritesResponse.get('favorites');
                
                // Delete each favorite
                for (Object favObj : favorites) {
                    Map<String, Object> favorite = (Map<String, Object>) favObj;
                    String favoriteId = (String) favorite.get('id');
                    
                    HttpRequest deleteReq = new HttpRequest();
                    deleteReq.setEndpoint(endpoint + '/' + favoriteId);
                    deleteReq.setMethod('DELETE');
                    deleteReq.setHeader('Authorization', 'Bearer ' + sessionId);
                    deleteReq.setTimeout(60000);
                    
                    HttpResponse deleteRes = http.send(deleteReq);
                    if (deleteRes.getStatusCode() == 204 || deleteRes.getStatusCode() == 200) {
                        deletedCount++;
                        System.debug('Deleted favorite: ' + favoriteId);
                    }
                }
            }
            
            // STEP 2: Query for records to add as favorites
            Map<String, String> recordIds = new Map<String, String>();
            
            // Query Jordan Lee Account
            List<Account> jordanLeeAccounts = [SELECT Id FROM Account WHERE Name = 'Jordan Lee' LIMIT 1];
            if (!jordanLeeAccounts.isEmpty()) {
                recordIds.put('JordanLee', jordanLeeAccounts[0].Id);
            }
            
            // Query Community Nutrition Program
            List<Program> programs = [SELECT Id FROM Program WHERE Name = 'Community Nutrition' LIMIT 1];
            if (!programs.isEmpty()) {
                recordIds.put('CommunityNutrition', programs[0].Id);
            }
            
            // Query Dashboard
            List<Dashboard> dashboards = [SELECT Id FROM Dashboard WHERE DeveloperName = 'Nonprofit_Mission_Control' LIMIT 1];
            if (!dashboards.isEmpty()) {
                recordIds.put('PMCC', dashboards[0].Id);
            }
            
            // Query Food Distribution VolunteerInitiative
            List<VolunteerInitiative> initiatives = [SELECT Id FROM VolunteerInitiative WHERE Name = 'Food Distribution' LIMIT 1];
            if (!initiatives.isEmpty()) {
                recordIds.put('FoodDist', initiatives[0].Id);
            }
            
            // Query Maria Rivera Account
            List<Account> mariaRiveraAccounts = [SELECT Id FROM Account WHERE Name = 'Maria Rivera' LIMIT 1];
            if (!mariaRiveraAccounts.isEmpty()) {
                recordIds.put('MariaRivera', mariaRiveraAccounts[0].Id);
            }
            
            // Query ApplicationReview
            List<ApplicationReview> appReviewRecords = [SELECT Id FROM ApplicationReview WHERE External_Id__c = 'NGO_Grants.19' LIMIT 1];
            if (!appReviewRecords.isEmpty()) {
                recordIds.put('AppReview', appReviewRecords[0].Id);
            }
            
            // STEP 3: Add new favorites
            List<Map<String, String>> favoritesToAdd = new List<Map<String, String>>();
            
            if (recordIds.containsKey('JordanLee')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('JordanLee'), 'targetType' => 'Record', 'sortOrder' => '1', 'name' => 'Jordan Lee'});
            }
            if (recordIds.containsKey('CommunityNutrition')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('CommunityNutrition'), 'targetType' => 'Record', 'sortOrder' => '2', 'name' => 'Community Nutrition'});
            }
            if (recordIds.containsKey('PMCC')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('PMCC'), 'targetType' => 'Record', 'sortOrder' => '3', 'name' => 'Program Management Command Center'});
            }
            if (recordIds.containsKey('FoodDist')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('FoodDist'), 'targetType' => 'Record', 'sortOrder' => '4', 'name' => 'Food Distribution'});
            }
            if (recordIds.containsKey('MariaRivera')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('MariaRivera'), 'targetType' => 'Record', 'sortOrder' => '5', 'name' => 'Maria Rivera'});
            }
            if (recordIds.containsKey('AppReview')) {
                favoritesToAdd.add(new Map<String, String>{'recordId' => recordIds.get('AppReview'), 'targetType' => 'Record', 'sortOrder' => '6', 'name' => 'Application Review 019'});
            }
            
            // Add each favorite via UI API
            for (Map<String, String> favorite : favoritesToAdd) {
                Map<String, Object> body = new Map<String, Object>{
                    'target' => favorite.get('recordId'),
                    'targetType' => favorite.get('targetType'),
                    'name' => favorite.get('name'),
                    'sortOrder' => favorite.get('sortOrder')
                };
                
                HttpRequest request = new HttpRequest();
                request.setEndpoint(endpoint);
                request.setMethod('POST');
                request.setHeader('Authorization', 'Bearer ' + sessionId);
                request.setHeader('Content-Type', 'application/json');
                request.setBody(JSON.serialize(body));
                request.setTimeout(60000);
                
                HttpResponse response = http.send(request);
                if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                    addedCount++;
                    System.debug('Added favorite: ' + favorite.get('name'));
                } else {
                    System.debug('Failed to add favorite: ' + favorite.get('name') + ' - Status: ' + response.getStatusCode());
                }
            }
            
            System.debug('Favorites management complete: ' + deletedCount + ' deleted, ' + addedCount + ' added');
            
        } catch (Exception e) {
            System.debug('Error managing favorites: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
        }
    }


}