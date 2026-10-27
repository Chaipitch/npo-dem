// Idempotent: renames ABC Hope gifts and recurring gifts to "Campaign - Cause - Donor - yyyy-MM-dd HH:mm" (D-38).
// Scope: GiftTransaction / GiftCommitment on an ABC Hope campaign, or by Maya, or created by the site guest user,
// a portal user or the agent. The org's other demo gifts are left alone.
// Date = the gift's own date (TransactionDate, or the commitment's EffectiveStartDate); time = when it was created,
// in TIME_ZONE (Bangkok, Maya's and the team's zone), so every renamed record uses one zone.
// Parts are shortened like TSAbcHopeDonationIntakeService.buildName: campaign 60, cause 40, donor 60 characters.
// Run: sf apex run -o npo-demo -f scripts/apex/renameGifts.apex
Boolean DRY_RUN = false; // true: print the first renames and roll back
String TIME_ZONE = 'Asia/Bangkok';

Set<String> CAMPAIGNS = new Set<String>{
  'Christmas Giving 2026',
  'Christmas Toy Drive 2026',
  'Christmas Meals for Families 2026',
  'Clean Water for Rural Schools',
  'Girls\' Education Scholarships',
  'Green Communities Tree Planting'
};
Set<String> DONOR_IDS = new Set<String>{ '001g70000175AtRAAU' }; // Maya Grande
Set<String> CREATORS = new Set<String>{
  'ABC Hope Site Guest User',
  'Maya Grande',
  'ServiceAgent Agentforce'
};

Savepoint sp = Database.setSavepoint();

// Commitments first: their names follow their own default cause and start date.
Map<Id, GiftCommitment> commitments = new Map<Id, GiftCommitment>([
  SELECT Id, Name, Campaign.Name, Donor.Name, EffectiveStartDate, CreatedDate
  FROM GiftCommitment
  WHERE
    Campaign.Name IN :CAMPAIGNS
    OR DonorId IN :DONOR_IDS
    OR CreatedBy.Name IN :CREATORS
]);
Map<Id, String> commitmentCause = new Map<Id, String>();
for (GiftDefaultDesignation gdd : [
  SELECT ParentRecordId, GiftDesignation.Name
  FROM GiftDefaultDesignation
  WHERE ParentRecordId IN :commitments.keySet()
  ORDER BY AllocatedPercentage DESC, CreatedDate ASC
]) {
  if (!commitmentCause.containsKey(gdd.ParentRecordId)) {
    commitmentCause.put(gdd.ParentRecordId, gdd.GiftDesignation.Name);
  }
}

Map<Id, GiftTransaction> gifts = new Map<Id, GiftTransaction>([
  SELECT Id, Name, Campaign.Name, Donor.Name, TransactionDate, CreatedDate, GiftCommitmentId
  FROM GiftTransaction
  WHERE
    Campaign.Name IN :CAMPAIGNS
    OR DonorId IN :DONOR_IDS
    OR CreatedBy.Name IN :CREATORS
    OR GiftCommitmentId IN :commitments.keySet()
]);
Map<Id, String> giftCause = new Map<Id, String>();
for (GiftTransactionDesignation gtd : [
  SELECT GiftTransactionId, GiftDesignation.Name
  FROM GiftTransactionDesignation
  WHERE GiftTransactionId IN :gifts.keySet() AND GiftDesignationId != NULL
  ORDER BY Percent DESC, CreatedDate ASC
]) {
  if (!giftCause.containsKey(gtd.GiftTransactionId)) {
    giftCause.put(gtd.GiftTransactionId, gtd.GiftDesignation.Name);
  }
}

List<GiftCommitment> commitmentUpdates = new List<GiftCommitment>();
for (GiftCommitment gc : commitments.values()) {
  String name = String.join(
    new List<String>{
      part(gc.Campaign?.Name, 60, 'No campaign'),
      part(commitmentCause.get(gc.Id), 40, 'No cause'),
      part(gc.Donor?.Name, 60, 'Unknown donor'),
      stamp(gc.EffectiveStartDate, gc.CreatedDate, TIME_ZONE)
    },
    ' - '
  );
  if (gc.Name != name) {
    commitmentUpdates.add(new GiftCommitment(Id = gc.Id, Name = name));
  }
}
List<GiftTransaction> giftUpdates = new List<GiftTransaction>();
for (GiftTransaction gt : gifts.values()) {
  // An instalment without its own designation takes its commitment's cause.
  String cause = giftCause.containsKey(gt.Id)
    ? giftCause.get(gt.Id)
    : commitmentCause.get(gt.GiftCommitmentId);
  String name = String.join(
    new List<String>{
      part(gt.Campaign?.Name, 60, 'No campaign'),
      part(cause, 40, 'No cause'),
      part(gt.Donor?.Name, 60, 'Unknown donor'),
      stamp(gt.TransactionDate, gt.CreatedDate, TIME_ZONE)
    },
    ' - '
  );
  if (gt.Name != name) {
    giftUpdates.add(new GiftTransaction(Id = gt.Id, Name = name));
  }
}

update commitmentUpdates;
update giftUpdates;

System.debug(
  LoggingLevel.ERROR,
  'Rename OK: ' +
    commitmentUpdates.size() +
    ' of ' +
    commitments.size() +
    ' commitments, ' +
    giftUpdates.size() +
    ' of ' +
    gifts.size() +
    ' gifts' +
    (DRY_RUN ? ' (dry run, rolled back)' : '')
);
Integer shown = 0;
for (GiftCommitment gc : commitmentUpdates) {
  if (shown++ < 5)
    System.debug(LoggingLevel.ERROR, 'GC ' + commitments.get(gc.Id).Name + '  =>  ' + gc.Name);
}
shown = 0;
for (GiftTransaction gt : giftUpdates) {
  if (shown++ < 12)
    System.debug(LoggingLevel.ERROR, 'GT ' + gifts.get(gt.Id).Name + '  =>  ' + gt.Name);
}
if (DRY_RUN)
  Database.rollback(sp);

String part(String value, Integer maxLength, String fallback) {
  return String.isBlank(value) ? fallback : value.normalizeSpace().abbreviate(maxLength);
}

// The gift's own date with the time the record was created, in the given time zone.
String stamp(Date day, Datetime created, String timeZone) {
  String dayText = day != null ? String.valueOf(day) : created.format('yyyy-MM-dd', timeZone);
  return dayText + ' ' + created.format('HH:mm', timeZone);
}
