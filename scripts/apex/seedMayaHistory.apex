// Demo giving history for returning donor Maya Grande (idempotent).
// Run: sf apex run -o npo-demo -f scripts/apex/seedMayaHistory.apex
Account maya = [SELECT Id FROM Account WHERE PersonEmail = 'maya@email.com' AND IsPersonAccount = TRUE LIMIT 1];
Map<String, GiftDesignation> gds = new Map<String, GiftDesignation>();
for (GiftDesignation gd : [SELECT Id, Name FROM GiftDesignation WHERE Name IN ('General Fund', 'Food Insecurity Fund', 'Job Training Fund')]) {
    gds.put(gd.Name, gd);
}
List<Object[]> history = new List<Object[]>{
    new Object[]{ 'Demo history - Maya - 2023', Date.newInstance(2023, 12, 10), 500, 'General Fund' },
    new Object[]{ 'Demo history - Maya - 2024', Date.newInstance(2024, 12, 12), 1000, 'Food Insecurity Fund' },
    new Object[]{ 'Demo history - Maya - 2025', Date.newInstance(2025, 6, 3), 750, 'Job Training Fund' }
};
Set<String> existing = new Set<String>();
for (GiftTransaction gt : [SELECT Name FROM GiftTransaction WHERE DonorId = :maya.Id AND Name LIKE 'Demo history - Maya%']) {
    existing.add(gt.Name);
}
for (Object[] h : history) {
    String name = (String) h[0];
    if (existing.contains(name)) continue;
    GiftTransaction gt = new GiftTransaction(Name = name, DonorId = maya.Id, TransactionDate = (Date) h[1],
        OriginalAmount = (Integer) h[2], Status = 'Paid', PaymentMethod = 'Credit Card', GiftType = 'Individual',
        Description = 'Demo history seed');
    insert gt;
    // Org automation adds a default 100% designation on Paid gifts; re-point it instead of adding another.
    List<GiftTransactionDesignation> auto = [SELECT Id FROM GiftTransactionDesignation WHERE GiftTransactionId = :gt.Id];
    if (auto.isEmpty()) {
        insert new GiftTransactionDesignation(GiftTransactionId = gt.Id, GiftDesignationId = gds.get((String) h[3]).Id, Percent = 100);
    } else {
        auto[0].GiftDesignationId = gds.get((String) h[3]).Id;
        update auto[0];
    }
}
System.debug('Maya history OK');
