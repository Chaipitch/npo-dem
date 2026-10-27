/** New gifts are named "Campaign - Cause - Donor - date time", whatever creates them (D-39). */
trigger TSAbcHopeGiftTransactionNaming on GiftTransaction(before insert) {
  TSAbcHopeGiftNaming.nameNewGifts(Trigger.new);
}
