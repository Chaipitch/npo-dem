// Idempotent: fundraising campaigns shown on the donor dashboard (records only — no metadata).
// A campaign appears on the dashboard when it is active, not ended, and has a GiftDefaultDesignation.
// Run: sf apex run -o npo-demo -f scripts/apex/seedCampaigns.apex
List<List<Object>> specs = new List<List<Object>>{
  // name, description, start, end, goal (USD), designation, designation description
  new List<Object>{
    'Christmas Giving 2026',
    'Give the gift of learning this Christmas — school supplies for children in need.',
    Date.newInstance(2026, 11, 15),
    Date.newInstance(2026, 12, 31),
    250000,
    'School Supplies',
    'Notebooks, pencils and books for children in need.'
  },
  new List<Object>{
    'Christmas Toy Drive 2026',
    'A Christmas present for every child: toys, books and warm clothes for children in shelters and foster care.',
    Date.newInstance(2026, 11, 1),
    Date.newInstance(2026, 12, 24),
    150000,
    'Toys & Gifts',
    'Toys, books and warm clothes wrapped and delivered to children at Christmas.'
  },
  new List<Object>{
    'Christmas Meals for Families 2026',
    'Share a Christmas meal: holiday food boxes for families who are struggling this season.',
    Date.newInstance(2026, 10, 19),
    Date.newInstance(2026, 12, 31),
    100000,
    'Holiday Meals',
    'Holiday food boxes delivered to families in need at Christmas.'
  },
  new List<Object>{
    'Clean Water for Rural Schools',
    'Install water filters and handwashing stations in rural schools so children stay healthy and in class.',
    Date.newInstance(2026, 9, 1),
    Date.newInstance(2027, 3, 31),
    300000,
    'Clean Water',
    'Water filters and handwashing stations for rural schools.'
  },
  new List<Object>{
    'Girls\' Education Scholarships',
    'Scholarships, uniforms and learning resources that keep girls in school in underserved areas.',
    Date.newInstance(2026, 6, 1),
    Date.newInstance(2027, 1, 31),
    500000,
    'Scholarships',
    'School fees, uniforms and learning resources for girls.'
  },
  new List<Object>{
    'Green Communities Tree Planting',
    'Plant trees and restore green spaces with local communities for healthier neighbourhoods.',
    Date.newInstance(2026, 8, 1),
    Date.newInstance(2027, 2, 28),
    200000,
    'Tree Planting',
    'Saplings, tools and community planting days.'
  }
};
// The org's original "Non Profit Event" campaign (with its gifts) became Christmas Meals for
// Families 2026; its own causes are replaced by the one listed above (REPLACE_DEFAULTS).
Set<String> REPLACE_DEFAULTS = new Set<String>{
  'Christmas Meals for Families 2026'
};
List<Campaign> oldEvent = [
  SELECT Id
  FROM Campaign
  WHERE Name = 'Non Profit Event'
  LIMIT 1
];
if (
  !oldEvent.isEmpty() &&
  [SELECT COUNT() FROM Campaign WHERE Name = 'Christmas Meals for Families 2026'] == 0
) {
  oldEvent[0].Name = 'Christmas Meals for Families 2026';
  update oldEvent;
}
Set<String> names = new Set<String>();
Set<String> gdNames = new Set<String>();
for (List<Object> s : specs) {
  names.add((String) s[0]);
  gdNames.add((String) s[5]);
}
Map<String, Campaign> camps = new Map<String, Campaign>();
for (Campaign c : [SELECT Id, Name FROM Campaign WHERE Name IN :names])
  camps.put(c.Name, c);
Map<String, GiftDesignation> gds = new Map<String, GiftDesignation>();
for (GiftDesignation g : [
  SELECT Id, Name
  FROM GiftDesignation
  WHERE Name IN :gdNames
])
  gds.put(g.Name, g);

List<Campaign> campUpserts = new List<Campaign>();
List<GiftDesignation> gdUpserts = new List<GiftDesignation>();
for (List<Object> s : specs) {
  Campaign c = camps.containsKey((String) s[0])
    ? camps.get((String) s[0])
    : new Campaign(Name = (String) s[0]);
  c.Description = (String) s[1];
  c.StartDate = (Date) s[2];
  c.EndDate = (Date) s[3];
  c.ExpectedRevenue = (Integer) s[4];
  c.IsActive = true;
  c.Status = 'In Progress';
  if (c.Id == null)
    c.Type = 'Other';
  campUpserts.add(c);
  GiftDesignation g = gds.containsKey((String) s[5])
    ? gds.get((String) s[5])
    : new GiftDesignation(Name = (String) s[5]);
  g.IsActive = true;
  g.Description = (String) s[6];
  gdUpserts.add(g);
}
upsert campUpserts;
upsert gdUpserts;
for (Campaign c : campUpserts)
  camps.put(c.Name, c);
for (GiftDesignation g : gdUpserts)
  gds.put(g.Name, g);

Map<String, String> designationByCampaign = new Map<String, String>();
for (List<Object> s : specs)
  designationByCampaign.put((String) s[0], (String) s[5]);
Set<Id> haveDefault = new Set<Id>();
List<GiftDefaultDesignation> replaced = new List<GiftDefaultDesignation>();
for (GiftDefaultDesignation d : [
  SELECT ParentRecordId, ParentRecord.Name, GiftDesignation.Name
  FROM GiftDefaultDesignation
  WHERE ParentRecordId IN :camps.values()
]) {
  if (
    REPLACE_DEFAULTS.contains(d.ParentRecord.Name) &&
    d.GiftDesignation.Name != designationByCampaign.get(d.ParentRecord.Name)
  ) {
    replaced.add(d);
  } else {
    haveDefault.add(d.ParentRecordId);
  }
}
delete replaced;
List<GiftDefaultDesignation> defaults = new List<GiftDefaultDesignation>();
for (List<Object> s : specs) {
  Campaign c = camps.get((String) s[0]);
  if (!haveDefault.contains(c.Id)) {
    defaults.add(
      new GiftDefaultDesignation(
        ParentRecordId = c.Id,
        GiftDesignationId = gds.get((String) s[5]).Id,
        AllocatedPercentage = 100
      )
    );
  }
}
insert defaults;
System.debug(
  'Campaigns OK: ' +
    campUpserts.size() +
    ' campaigns, ' +
    defaults.size() +
    ' new default designations, ' +
    replaced.size() +
    ' replaced'
);
