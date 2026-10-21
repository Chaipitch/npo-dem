trigger ngo_GiftEntryTrigger on GiftEntry (after update) {
    if (Trigger.isAfter && Trigger.isUpdate) {
        List<GiftEntry> processedEntries = new List<GiftEntry>();
        
        for (GiftEntry entry : Trigger.new) {
            GiftEntry oldEntry = Trigger.oldMap.get(entry.Id);
            
            if (entry.GiftProcessingStatus == 'Success' && 
                entry.GiftProcessingStatus != oldEntry.GiftProcessingStatus &&
                String.isNotBlank(entry.GiftTransactionId)) {
                
                processedEntries.add(entry);
            }
        }
        
        if (!processedEntries.isEmpty()) {
            ngo_GiftEntryService.updateTransactions(processedEntries);
            ngo_GiftEntryService.processTributesFromEntry(processedEntries);
        }
    }
}