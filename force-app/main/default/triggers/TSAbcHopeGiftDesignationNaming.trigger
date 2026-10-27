/** A gift's name follows its cause: re-name it when its designations change (D-39). */
trigger TSAbcHopeGiftDesignationNaming on GiftTransactionDesignation(
  after insert,
  after update,
  after delete
) {
  Set<Id> giftIds = new Set<Id>();
  for (
    GiftTransactionDesignation gtd : Trigger.isDelete
      ? Trigger.old
      : Trigger.new
  ) {
    giftIds.add(gtd.GiftTransactionId);
  }
  TSAbcHopeGiftNaming.renameGifts(giftIds);
}
