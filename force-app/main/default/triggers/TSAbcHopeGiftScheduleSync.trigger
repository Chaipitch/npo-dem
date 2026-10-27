/** A pause added, changed or removed updates the gift's Status and Next Transaction Date (D-40). */
trigger TSAbcHopeGiftScheduleSync on GiftCommitmentSchedule(
  after insert,
  after update,
  after delete
) {
  Set<Id> commitmentIds = new Set<Id>();
  for (
    GiftCommitmentSchedule s : Trigger.isDelete ? Trigger.old : Trigger.new
  ) {
    commitmentIds.add(s.GiftCommitmentId);
  }
  TSAbcHopeCommitmentPauseSync.sync(commitmentIds);
}
