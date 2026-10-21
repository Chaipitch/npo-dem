// Idempotent seed for the Christmas Giving 2026 demo (records only — no metadata).
// Run: sf apex run -o npo-demo -f scripts/apex/seedChristmasGiving.apex

String campaignName = 'Christmas Giving 2026';
List<Campaign> camps = [SELECT Id FROM Campaign WHERE Name = :campaignName LIMIT 1];
Campaign camp = camps.isEmpty() ? new Campaign(Name = campaignName) : camps[0];
camp.Type = 'Email';
camp.Status = 'In Progress';
camp.IsActive = true;
camp.StartDate = Date.newInstance(2026, 11, 15);
camp.EndDate = Date.newInstance(2026, 12, 31);
camp.Description = 'Give the gift of learning this Christmas — school supplies for children.';
upsert camp;

Map<String, String> designations = new Map<String, String>{
    'School Supplies' => 'Notebooks, pencils and books for children in need.',
    'Learning Kits' => 'Complete learning kits for primary school students.',
    'Where Most Needed' => 'Flexible support for ABC Hope programs.'
};
Map<String, GiftDesignation> existing = new Map<String, GiftDesignation>();
for (GiftDesignation gd : [SELECT Id, Name FROM GiftDesignation WHERE Name IN :designations.keySet()]) {
    existing.put(gd.Name, gd);
}
List<GiftDesignation> gds = new List<GiftDesignation>();
for (String n : designations.keySet()) {
    GiftDesignation gd = existing.containsKey(n) ? existing.get(n) : new GiftDesignation(Name = n);
    gd.IsActive = true;
    gd.Description = designations.get(n);
    gds.add(gd);
}
upsert gds;

GiftDesignation school = [SELECT Id FROM GiftDesignation WHERE Name = 'School Supplies' LIMIT 1];
if ([SELECT COUNT() FROM GiftDefaultDesignation WHERE ParentRecordId = :camp.Id] == 0) {
    insert new GiftDefaultDesignation(ParentRecordId = camp.Id, GiftDesignationId = school.Id, AllocatedPercentage = 100);
}

List<OutreachSourceCode> oscs = [SELECT Id FROM OutreachSourceCode WHERE SourceCode = 'XMAS26-EMAIL' LIMIT 1];
OutreachSourceCode osc = oscs.isEmpty() ? new OutreachSourceCode(SourceCode = 'XMAS26-EMAIL') : oscs[0];
osc.Name = 'Email – Christmas Appeal';
osc.CampaignId = camp.Id;
osc.Status = 'Active';
osc.UsageType = 'Fundraising';
osc.MessageChannel = 'Email';
osc.MessageContentTitle = 'A brighter Christmas for every child';
upsert osc;

System.debug('Seed OK: campaign ' + camp.Id + ', source code ' + osc.Id);
