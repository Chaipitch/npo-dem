/** New gifts keep their commitment's campaign (D-41) and are named "Campaign - Cause - Donor - date time" (D-39). */
trigger TSAbcHopeGiftTransactionNaming on GiftTransaction(before insert) {
  TSAbcHopeCommitmentCampaign.fillGifts(Trigger.new);
  TSAbcHopeGiftNaming.nameNewGifts(Trigger.new);
}
