/**
 * New schedules keep their commitment's campaign (D-41); a pause added, changed or removed updates the gift's
 * Status and Next Transaction Date (D-40).
 */
trigger TSAbcHopeGiftScheduleSync on GiftCommitmentSchedule(
  before insert,
  after insert,
  after update,
  after delete
) {
  if (Trigger.isBefore) {
    TSAbcHopeCommitmentCampaign.fillSchedules(Trigger.new);
    return;
  }
  Set<Id> commitmentIds = new Set<Id>();
  for (
    GiftCommitmentSchedule s : Trigger.isDelete ? Trigger.old : Trigger.new
  ) {
    commitmentIds.add(s.GiftCommitmentId);
  }
  TSAbcHopeCommitmentPauseSync.sync(commitmentIds);
}
