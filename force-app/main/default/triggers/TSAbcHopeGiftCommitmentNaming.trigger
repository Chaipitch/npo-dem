/** New recurring gifts are named "Campaign - Cause - Donor - date time"; the cause follows with its default designation (D-39). */
trigger TSAbcHopeGiftCommitmentNaming on GiftCommitment(before insert) {
  TSAbcHopeGiftNaming.nameNewCommitments(Trigger.new);
}
