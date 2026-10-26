// Idempotent: the Programs ABC Hope's campaigns fund, linked through each designation (D-21).
// Campaign ─< GiftDefaultDesignation >─ GiftDesignation ─> Program (GiftDesignation.NGOTV_Program__c).
// Records only — no metadata. Run after seedCampaigns.apex and seedChristmasGiving.apex.
// Designations not listed here (Where Most Needed, Unrestricted, General Fund, ...) are left untouched.
// Run: sf apex run -o npo-demo -f scripts/apex/seedPrograms.apex
List<List<Object>> specs = new List<List<Object>>{
  // program, summary, designations it funds
  new List<Object>{
    'Education Access',
    'School supplies, learning kits and scholarships that keep children learning.',
    new List<String>{
      'School Supplies',
      'Learning Kits',
      'Scholarships',
      'Books for Kids'
    }
  },
  new List<Object>{
    'Clean Water',
    'Water filters and handwashing stations for rural schools.',
    new List<String>{ 'Clean Water', 'Handwashing Stations' }
  },
  new List<Object>{
    'Child Wellbeing',
    'Christmas presents, warm clothes and care for children in shelters and foster care.',
    new List<String>{ 'Toys & Gifts', 'Warm Clothes' }
  },
  new List<Object>{
    'Family Support',
    'Holiday meals and seasonal help for families who are struggling.',
    new List<String>{ 'Holiday Meals', 'Grocery Vouchers' }
  },
  new List<Object>{
    'Green Communities',
    'Tree planting and green spaces restored with local communities.',
    new List<String>{ 'Tree Planting' }
  }
};
Set<String> programNames = new Set<String>();
Set<String> gdNames = new Set<String>();
for (List<Object> s : specs) {
  programNames.add((String) s[0]);
  gdNames.addAll((List<String>) s[2]);
}
Map<String, Program> programs = new Map<String, Program>();
for (Program p : [SELECT Id, Name FROM Program WHERE Name IN :programNames])
  programs.put(p.Name, p);

List<Program> programUpserts = new List<Program>();
for (List<Object> s : specs) {
  Program p = programs.containsKey((String) s[0])
    ? programs.get((String) s[0])
    : new Program(
        Name = (String) s[0],
        StartDate = Date.newInstance(2026, 1, 1)
      );
  p.Summary = (String) s[1];
  p.Status = 'Active';
  programUpserts.add(p);
}
upsert programUpserts;
for (Program p : programUpserts)
  programs.put(p.Name, p);

Map<String, Id> programByDesignation = new Map<String, Id>();
for (List<Object> s : specs) {
  for (String gd : (List<String>) s[2])
    programByDesignation.put(gd, programs.get((String) s[0]).Id);
}
List<GiftDesignation> gdUpdates = new List<GiftDesignation>();
Set<String> found = new Set<String>();
for (GiftDesignation g : [
  SELECT Id, Name, NGOTV_Program__c
  FROM GiftDesignation
  WHERE Name IN :gdNames
]) {
  found.add(g.Name);
  Id programId = programByDesignation.get(g.Name);
  if (g.NGOTV_Program__c != programId) {
    g.NGOTV_Program__c = programId;
    gdUpdates.add(g);
  }
}
update gdUpdates;
gdNames.removeAll(found);
System.debug(
  'Programs OK: ' +
    programUpserts.size() +
    ' programs, ' +
    gdUpdates.size() +
    ' designations linked' +
    (gdNames.isEmpty()
      ? ''
      : '; missing designations (run the other seed scripts first): ' + gdNames)
);
