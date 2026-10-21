public with sharing class NGO_MissionControl_UpdateDates {
    
    @AuraEnabled
    public static String updateRecords() {
        try {
            Date today = Date.today();
            Date threeDaysFromNow = today.addDays(3);
            
            List<SObject> recordsToUpdate = new List<SObject>();
            List<String> updateMessages = new List<String>();
            
            // Query and update Task record
            List<Task> tasks = [
                SELECT Id, ActivityDate, External_Id__c 
                FROM Task 
                WHERE External_Id__c = 'NGO_MissionControl.1'
                LIMIT 1
            ];
            
            if (!tasks.isEmpty()) {
                Task taskToUpdate = tasks[0];
                taskToUpdate.ActivityDate = today;
                recordsToUpdate.add(taskToUpdate);
                updateMessages.add('Task updated');
            } else {
                updateMessages.add('Task not found');
            }
            
            // Query and update Opportunity record
            List<Opportunity> opportunities = [
                SELECT Id, CloseDate, External_Id__c 
                FROM Opportunity 
                WHERE External_Id__c = 'NGO_MissionControl.1'
                LIMIT 1
            ];
            
            if (!opportunities.isEmpty()) {
                Opportunity oppToUpdate = opportunities[0];
                oppToUpdate.CloseDate = today;
                recordsToUpdate.add(oppToUpdate);
                updateMessages.add('Opportunity updated');
            } else {
                updateMessages.add('Opportunity not found');
            }
            
            // Query and update ApplicationReview record
            List<ApplicationReview> appReviews = [
                SELECT Id, DueDate, External_Id__c 
                FROM ApplicationReview 
                WHERE External_Id__c = 'NGOGrants.19'
                LIMIT 1
            ];
            
            if (!appReviews.isEmpty()) {
                ApplicationReview reviewToUpdate = appReviews[0];
                reviewToUpdate.DueDate = threeDaysFromNow;
                recordsToUpdate.add(reviewToUpdate);
                updateMessages.add('ApplicationReview updated');
            } else {
                updateMessages.add('ApplicationReview not found');
            }
            
            // Perform DML operation
            if (!recordsToUpdate.isEmpty()) {
                update recordsToUpdate;
            }
            
            // Reorder App Menu (asynchronous)
            reorderAppMenu();
            updateMessages.add('App menu reordering initiated');
            
            // Manage Favorites (asynchronous)
            System.enqueueJob(new NGO_MissionControl_Favorites_Queueable());
            updateMessages.add('Favorites management initiated');
            
            return String.join(updateMessages, ', ');
            
        } catch (Exception e) {
            throw new AuraHandledException('Error updating records: ' + e.getMessage());
        }
    }
    
    private static void reorderAppMenu() {
        // List of Application Names you want to set in order
        List<String> appNames = new List<String>{
            'Nonprofit Mission Control',
            'Programs',
            'Philanthropy And Partnerships',
            'Fundraising Operations',
            'Fundraising Strategy',
            'Donor Engagement',
            'Grantmaking',
            'Nonprofit Service Excellence',
            'Outcome Management',
            'Program Management',
            'Accounting Subledger',
            'Data Cloud',
            'OmniStudio',
            'Analytics Studio',
            'Q Branch'
        };
        
        try {
            // Create a list to store the ApplicationIds
            List<Id> appIds = new List<Id>();
            
            // Step 1: Query for AppMenuItems by Name
            for (String appName : appNames) {
                List<AppMenuItem> appItems = [
                    SELECT Id, Name, Label, ApplicationId
                    FROM AppMenuItem
                    WHERE Label = :appName AND IsVisible = true
                    LIMIT 1
                ];
                
                if (!appItems.isEmpty() && appItems[0].ApplicationId != null) {
                    appIds.add(appItems[0].ApplicationId);
                    System.debug('Found app: ' + appName + ' with ApplicationId: ' + appItems[0].ApplicationId);
                } else {
                    System.debug('Warning: App with Name = "' + appName + '" not found or has no ApplicationId');
                }
            }
            
            // Step 2: Enqueue the reordering operation asynchronously
            if (!appIds.isEmpty()) {
                System.debug('Enqueueing app order with ApplicationIds: ' + appIds);
                System.enqueueJob(new AppMenuReorderQueueable(appIds));
                System.debug('App Menu reordering job enqueued successfully');
            } else {
                System.debug('Error: No ApplicationIds found to reorder');
            }
            
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
            System.debug('Line: ' + e.getLineNumber());
            System.debug('Stack trace: ' + e.getStackTraceString());
        }
    }
}