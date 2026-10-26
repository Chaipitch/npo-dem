// Idempotent: fundraising campaigns shown on the donor dashboard (records only — no metadata).
// A campaign appears on the dashboard when it is active, not ended, and has a GiftDefaultDesignation.
// Run: sf apex run -o npo-demo -f scripts/apex/seedCampaigns.apex
List<List<Object>> specs = new List<List<Object>>{
    // name, description, start, end, goal (USD), designation, designation description
    new List<Object>{ 'Christmas Giving 2026', 'Give the gift of learning this Christmas — school supplies for children in need.', Date.newInstance(2026, 11, 15), Date.newInstance(2026, 12, 31), 250000, 'School Supplies', 'Notebooks, pencils and books for children in need.' },
    new List<Object>{ 'Clean Water for Rural Schools', 'Install water filters and handwashing stations in rural schools so children stay healthy and in class.', Date.newInstance(2026, 9, 1), Date.newInstance(2027, 3, 31), 300000, 'Clean Water', 'Water filters and handwashing stations for rural schools.' },
    new List<Object>{ 'Girls\' Education Scholarships', 'Scholarships, uniforms and learning resources that keep girls in school in underserved areas.', Date.newInstance(2026, 6, 1), Date.newInstance(2027, 1, 31), 500000, 'Scholarships', 'School fees, uniforms and learning resources for girls.' },
    new List<Object>{ 'Green Communities Tree Planting', 'Plant trees and restore green spaces with local communities for healthier neighbourhoods.', Date.newInstance(2026, 8, 1), Date.newInstance(2027, 2, 28), 200000, 'Tree Planting', 'Saplings, tools and community planting days.' }
};
Set<String> names = new Set<String>();
Set<String> gdNames = new Set<String>();
for (List<Object> s : specs) { names.add((String) s[0]); gdNames.add((String) s[5]); }
Map<String, Campaign> camps = new Map<String, Campaign>();
for (Campaign c : [SELECT Id, Name FROM Campaign WHERE Name IN :names]) camps.put(c.Name, c);
Map<String, GiftDesignation> gds = new Map<String, GiftDesignation>();
for (GiftDesignation g : [SELECT Id, Name FROM GiftDesignation WHERE Name IN :gdNames]) gds.put(g.Name, g);

List<Campaign> campUpserts = new List<Campaign>();
List<GiftDesignation> gdUpserts = new List<GiftDesignation>();
for (List<Object> s : specs) {
    Campaign c = camps.containsKey((String) s[0]) ? camps.get((String) s[0]) : new Campaign(Name = (String) s[0]);
    c.Description = (String) s[1]; c.StartDate = (Date) s[2]; c.EndDate = (Date) s[3];
    c.ExpectedRevenue = (Integer) s[4]; c.IsActive = true; c.Status = 'In Progress';
    if (c.Id == null) c.Type = 'Other';
    campUpserts.add(c);
    GiftDesignation g = gds.containsKey((String) s[5]) ? gds.get((String) s[5]) : new GiftDesignation(Name = (String) s[5]);
    g.IsActive = true; g.Description = (String) s[6];
    gdUpserts.add(g);
}
upsert campUpserts;
upsert gdUpserts;
for (Campaign c : campUpserts) camps.put(c.Name, c);
for (GiftDesignation g : gdUpserts) gds.put(g.Name, g);

Set<Id> haveDefault = new Set<Id>();
for (GiftDefaultDesignation d : [SELECT ParentRecordId FROM GiftDefaultDesignation WHERE ParentRecordId IN :camps.values()]) haveDefault.add(d.ParentRecordId);
List<GiftDefaultDesignation> defaults = new List<GiftDefaultDesignation>();
for (List<Object> s : specs) {
    Campaign c = camps.get((String) s[0]);
    if (!haveDefault.contains(c.Id)) {
        defaults.add(new GiftDefaultDesignation(ParentRecordId = c.Id, GiftDesignationId = gds.get((String) s[5]).Id, AllocatedPercentage = 100));
    }
}
insert defaults;
System.debug('Campaigns OK: ' + campUpserts.size() + ' campaigns, ' + defaults.size() + ' new default designations');
