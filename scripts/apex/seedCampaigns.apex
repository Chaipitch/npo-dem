// Idempotent: fundraising campaigns shown on the donor dashboard (records only — no metadata).
// A campaign appears on the dashboard when it is active, not ended, and has a GiftDefaultDesignation.
// Each campaign's causes (GiftDefaultDesignation rows) are made to match this script exactly.
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
    'Water filters that give rural schools safe drinking water.'
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
// Campaigns with more than one cause: name, percentage, description (null = keep the existing one).
// The first cause has the highest share, so the donation journey pre-selects it. Shares add up to 100.
// Campaigns not listed here have one cause (the spec's designation) at 100%.
Map<String, List<List<Object>>> causes = new Map<String, List<List<Object>>>{
  'Christmas Toy Drive 2026' => new List<List<Object>>{
    new List<Object>{ 'Toys & Gifts', 34, null },
    new List<Object>{ 'Warm Clothes', 33, 'Coats, jumpers and warm clothes for children this winter.' },
    new List<Object>{ 'Books for Kids', 33, 'Picture books and storybooks children can keep.' }
  },
  'Christmas Meals for Families 2026' => new List<List<Object>>{
    new List<Object>{ 'Holiday Meals', 50, null },
    new List<Object>{ 'Grocery Vouchers', 50, 'Grocery vouchers so families can shop for the holidays.' }
  },
  'Christmas Giving 2026' => new List<List<Object>>{
    new List<Object>{ 'School Supplies', 50, null },
    new List<Object>{ 'Learning Kits', 50, null }
  },
  'Clean Water for Rural Schools' => new List<List<Object>>{
    new List<Object>{ 'Clean Water', 50, null },
    new List<Object>{ 'Handwashing Stations', 50, 'Handwashing stations and soap for rural schools.' }
  }
};
// The org's original "Non Profit Event" campaign (with its gifts) became Christmas Meals for Families 2026.
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
  if (!causes.containsKey((String) s[0])) {
    causes.put(
      (String) s[0],
      new List<List<Object>>{ new List<Object>{ (String) s[5], 100, null } }
    );
  }
}
Map<String, String> extraDescriptions = new Map<String, String>();
for (List<List<Object>> campaignCauses : causes.values()) {
  for (List<Object> cause : campaignCauses) {
    gdNames.add((String) cause[0]);
    if (cause[2] != null)
      extraDescriptions.put((String) cause[0], (String) cause[2]);
  }
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
Set<String> specDesignations = new Set<String>();
for (GiftDesignation g : gdUpserts)
  specDesignations.add(g.Name);
for (String n : extraDescriptions.keySet()) {
  if (specDesignations.contains(n))
    continue;
  GiftDesignation g = gds.containsKey(n)
    ? gds.get(n)
    : new GiftDesignation(Name = n);
  g.IsActive = true;
  g.Description = extraDescriptions.get(n);
  gdUpserts.add(g);
}
upsert campUpserts;
upsert gdUpserts;
for (Campaign c : campUpserts)
  camps.put(c.Name, c);
for (GiftDesignation g : gdUpserts)
  gds.put(g.Name, g);

Map<Id, String> campaignNameById = new Map<Id, String>();
for (Campaign c : camps.values())
  campaignNameById.put(c.Id, c.Name);
Map<String, GiftDefaultDesignation> existingDefaults = new Map<String, GiftDefaultDesignation>();
List<GiftDefaultDesignation> removed = new List<GiftDefaultDesignation>();
List<GiftDefaultDesignation> changed = new List<GiftDefaultDesignation>();
for (GiftDefaultDesignation d : [
  SELECT Id, ParentRecordId, GiftDesignation.Name, AllocatedPercentage
  FROM GiftDefaultDesignation
  WHERE ParentRecordId IN :camps.values()
]) {
  String campaignName = campaignNameById.get(d.ParentRecordId);
  Decimal share = null;
  for (List<Object> cause : causes.get(campaignName)) {
    if (cause[0] == d.GiftDesignation.Name)
      share = (Integer) cause[1];
  }
  if (share == null) {
    removed.add(d);
    continue;
  }
  existingDefaults.put(campaignName + '|' + d.GiftDesignation.Name, d);
  if (d.AllocatedPercentage != share) {
    d.AllocatedPercentage = share;
    changed.add(d);
  }
}
// Remove and shrink shares before adding causes, so a campaign never goes over 100%.
delete removed;
update changed;
List<GiftDefaultDesignation> defaults = new List<GiftDefaultDesignation>();
for (List<Object> s : specs) {
  Campaign c = camps.get((String) s[0]);
  for (List<Object> cause : causes.get(c.Name)) {
    if (!existingDefaults.containsKey(c.Name + '|' + cause[0])) {
      defaults.add(
        new GiftDefaultDesignation(
          ParentRecordId = c.Id,
          GiftDesignationId = gds.get((String) cause[0]).Id,
          AllocatedPercentage = (Integer) cause[1]
        )
      );
    }
  }
}
insert defaults;
System.debug(
  'Campaigns OK: ' +
    campUpserts.size() +
    ' campaigns, ' +
    defaults.size() +
    ' causes added, ' +
    changed.size() +
    ' shares changed, ' +
    removed.size() +
    ' removed'
);
