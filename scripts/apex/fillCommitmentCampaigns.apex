// Idempotent: schedules and instalments saved without a campaign take their commitment's (D-41).
// New records are filled by the triggers; this is for records saved before them. Run renameGifts.apex afterwards
// so the instalments' names show the campaign.
// Run: sf apex run -o npo-demo -f scripts/apex/fillCommitmentCampaigns.apex
Boolean DRY_RUN = false; // true: report and roll back

Savepoint sp = Database.setSavepoint();
List<GiftCommitmentSchedule> schedules = new List<GiftCommitmentSchedule>();
for (GiftCommitmentSchedule s : [
  SELECT Id, GiftCommitment.CampaignId
  FROM GiftCommitmentSchedule
  WHERE CampaignId = NULL AND GiftCommitment.CampaignId != NULL
]) {
  schedules.add(new GiftCommitmentSchedule(Id = s.Id, CampaignId = s.GiftCommitment.CampaignId));
}
List<GiftTransaction> gifts = new List<GiftTransaction>();
for (GiftTransaction gt : [
  SELECT Id, GiftCommitment.CampaignId
  FROM GiftTransaction
  WHERE CampaignId = NULL AND GiftCommitment.CampaignId != NULL
]) {
  gifts.add(new GiftTransaction(Id = gt.Id, CampaignId = gt.GiftCommitment.CampaignId));
}
List<String> problems = new List<String>();
for (Database.SaveResult r : Database.update(schedules, false)) {
  if (!r.isSuccess()) problems.add('schedule ' + r.getId() + ': ' + r.getErrors()[0].getMessage());
}
for (Database.SaveResult r : Database.update(gifts, false)) {
  if (!r.isSuccess()) problems.add('gift ' + r.getId() + ': ' + r.getErrors()[0].getMessage());
}
System.debug(
  LoggingLevel.ERROR,
  'Campaign fill: ' + schedules.size() + ' schedules, ' + gifts.size() + ' gifts, ' + problems.size() + ' refused'
    + (DRY_RUN ? ' (dry run, rolled back)' : '') + (problems.isEmpty() ? '' : ' :: ' + String.join(problems, ' | '))
);
if (DRY_RUN)
  Database.rollback(sp);
