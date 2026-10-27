/**
 * Recurring gifts keep their campaign (D-41). NPC's pause, resume and change-amount actions save new schedules
 * without a campaign, and NPC copies the schedule's (empty) campaign onto the next instalment, so those
 * instalments drop out of the campaign's raised amount. Before insert, a schedule or instalment without a campaign
 * takes its commitment's.
 */
public without sharing class TSAbcHopeCommitmentCampaign {
  public static void fillSchedules(List<GiftCommitmentSchedule> schedules) {
    Map<Id, Id> campaigns = commitmentCampaigns(schedules, 'GiftCommitmentId');
    for (GiftCommitmentSchedule s : schedules) {
      if (s.CampaignId == null) {
        s.CampaignId = campaigns.get(s.GiftCommitmentId);
      }
    }
  }

  public static void fillGifts(List<GiftTransaction> gifts) {
    Map<Id, Id> campaigns = commitmentCampaigns(gifts, 'GiftCommitmentId');
    for (GiftTransaction gt : gifts) {
      if (gt.CampaignId == null) {
        gt.CampaignId = campaigns.get(gt.GiftCommitmentId);
      }
    }
  }

  /** Commitment Id → its campaign, for the records that have a commitment but no campaign. */
  static Map<Id, Id> commitmentCampaigns(List<SObject> records, String field) {
    Set<Id> commitmentIds = new Set<Id>();
    for (SObject r : records) {
      if (r.get('CampaignId') == null && r.get(field) != null) {
        commitmentIds.add((Id) r.get(field));
      }
    }
    Map<Id, Id> campaigns = new Map<Id, Id>();
    if (!commitmentIds.isEmpty()) {
      for (GiftCommitment gc : [
        SELECT Id, CampaignId
        FROM GiftCommitment
        WHERE Id IN :commitmentIds AND CampaignId != NULL
      ]) {
        campaigns.put(gc.Id, gc.CampaignId);
      }
    }
    return campaigns;
  }
}
