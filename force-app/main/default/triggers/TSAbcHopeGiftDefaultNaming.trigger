/** A recurring gift's name follows its cause: re-name it when its default designations change (D-39). */
trigger TSAbcHopeGiftDefaultNaming on GiftDefaultDesignation(
  after insert,
  after update,
  after delete
) {
  Set<Id> parentIds = new Set<Id>();
  for (
    GiftDefaultDesignation gdd : Trigger.isDelete ? Trigger.old : Trigger.new
  ) {
    parentIds.add(gdd.ParentRecordId);
  }
  TSAbcHopeGiftNaming.renameCommitments(parentIds);
}
