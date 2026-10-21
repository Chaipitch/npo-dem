public with sharing class ngo_GiftTributeController {
    
    @AuraEnabled
    public static GiftTransaction getRecentTransaction() {
        List<GiftTransaction> trans = [
            SELECT Id, Name, GiftCommitmentId, TransactionDate 
            FROM GiftTransaction 
            WHERE CreatedById = :UserInfo.getUserId()
            AND CreatedDate >= :DateTime.now().addMinutes(-15)
            ORDER BY CreatedDate DESC 
            LIMIT 1
        ];
        
        return (trans.isEmpty()) ? null : trans[0];
    }
}