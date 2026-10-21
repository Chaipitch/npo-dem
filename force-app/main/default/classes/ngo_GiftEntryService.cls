public with sharing class ngo_GiftEntryService {
    
    public class TributeWrapper {
        public String TributeType;
        public String HonoreeContactId; 
        public String HonoreeName;
        public String NotificationContactId; 
        public String NotificationContactName;
        public String NotificationChannel;
        public String NotificationEmail;
        public String NotificationMessage;
    }

    public static void updateTransactions(List<GiftEntry> entries) {
        List<GiftTransaction> transToUpdate = new List<GiftTransaction>();
        Map<String, Schema.RecordTypeInfo> rtMap = Schema.SObjectType.GiftTransaction.getRecordTypeInfosByName();
        
        for (GiftEntry entry : entries) {
            Boolean isChanged = false;
            GiftTransaction gt = new GiftTransaction(Id = entry.GiftTransactionId);

            String rtName = entry.Gift_Transaction_RecordType__c;
            if (String.isNotBlank(rtName) && rtMap.containsKey(rtName)) {
                gt.RecordTypeId = rtMap.get(rtName).getRecordTypeId();
                isChanged = true;
            }

            String txName = entry.Gift_Transaction_Name__c;
            if (String.isNotBlank(txName)) {
                gt.Name = txName;
                isChanged = true;
            }

            String txStatus = entry.Gift_Transaction_Status__c;
            if (String.isNotBlank(txStatus)) {
                gt.Status = txStatus;
                isChanged = true;
            }

            if (isChanged) {
                transToUpdate.add(gt);
            }
        }
        
        if (!transToUpdate.isEmpty()) {
            try {
                update transToUpdate;
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, e.getMessage());
            }
        }
    }

    public static void processTributesFromEntry(List<GiftEntry> entries) {
        List<GiftTribute> tributesToInsert = new List<GiftTribute>();
        
        for (GiftEntry entry : entries) {
            if (String.isBlank(entry.TributesJSON__c)) {
                continue; 
            }

            try {
                List<TributeWrapper> wrappers = (List<TributeWrapper>) JSON.deserialize(
                    entry.TributesJSON__c, List<TributeWrapper>.class
                );

                for (TributeWrapper tw : wrappers) {
                    GiftTribute newTribute = new GiftTribute();
                    newTribute.GiftTransactionId = entry.GiftTransactionId;
                    
                    newTribute.TributeType = tw.TributeType;
                    newTribute.HonoreeName = tw.HonoreeName;
                    newTribute.NotificationContactName = tw.NotificationContactName;
                    newTribute.NotificationChannel = tw.NotificationChannel;
                    newTribute.NotificationEmail = tw.NotificationEmail;
                    newTribute.NotificationMessage = tw.NotificationMessage;

                    if (String.isNotBlank(tw.HonoreeContactId)) {
                        newTribute.HonoreeContactId = tw.HonoreeContactId;
                    }

                    if (String.isNotBlank(tw.NotificationContactId)) {
                        newTribute.NotificationContactId = tw.NotificationContactId;
                    }

                    tributesToInsert.add(newTribute);
                }

            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, e.getMessage());
            }
        }

        if (!tributesToInsert.isEmpty()) {
            insert tributesToInsert;
        }
    }
}