/**
 * The one naming rule for gifts (D-38, D-39): "Campaign - Cause - Donor - yyyy-MM-dd HH:mm".
 * Used by the site (TSAbcHopeDonationIntakeService), by the triggers on GiftTransaction, GiftCommitment,
 * GiftTransactionDesignation and GiftDefaultDesignation (so gifts from Gift Entry, imports and NPC-generated
 * instalments follow it too) and by scripts/apex/renameGifts.apex.
 *
 * Date = the gift's own date (TransactionDate, or a commitment's EffectiveStartDate), or the date it was created
 * when the two are within a day of each other; time = when the record was created. Both in the org's default time
 * zone (Setup → Company Information; America/Los_Angeles on 27 Oct 2026). The cause is the designation with the largest share (a gift without one takes its
 * commitment's). Each part is shortened on its own so the date and time always stay.
 */
public without sharing class TSAbcHopeGiftNaming {
  /** The org's default time zone, read once per transaction. */
  public static String timeZone {
    get {
      if (timeZone == null) {
        timeZone = [SELECT TimeZoneSidKey FROM Organization LIMIT 1]
        .TimeZoneSidKey;
      }
      return timeZone;
    }
    private set;
  }
  static final Integer CAMPAIGN_MAX = 60;
  static final Integer CAUSE_MAX = 40;
  static final Integer DONOR_MAX = 60;

  public static String build(
    String campaignName,
    String causeName,
    String donorName,
    Date day,
    Datetime created
  ) {
    Datetime stampTime = created != null ? created : Datetime.now();
    String createdDay = stampTime.format('yyyy-MM-dd', timeZone);
    // A gift dated on the day it was made (in whoever's time zone saved it) shows the org-time-zone date, so the
    // date and time agree; back-dated history and future instalments keep their own date.
    String dayText = day == null ||
      Math.abs(day.daysBetween(Date.valueOf(createdDay))) <= 1
      ? createdDay
      : String.valueOf(day);
    return String.join(
      new List<String>{
        part(campaignName, CAMPAIGN_MAX, 'No campaign'),
        part(causeName, CAUSE_MAX, 'No cause'),
        part(donorName, DONOR_MAX, 'Unknown donor'),
        dayText +
        ' ' +
        stampTime.format('HH:mm', timeZone)
      },
      ' - '
    );
  }

  static String part(String value, Integer maxLength, String fallback) {
    return String.isBlank(value)
      ? fallback
      : value.normalizeSpace().abbreviate(maxLength);
  }

  // ---------------------------------------------------------------- before insert

  /** Names new gifts; the cause comes from the commitment for instalments, else later from its designation. */
  public static void nameNewGifts(List<GiftTransaction> gifts) {
    Set<Id> campaignIds = new Set<Id>();
    Set<Id> donorIds = new Set<Id>();
    Set<Id> commitmentIds = new Set<Id>();
    for (GiftTransaction gt : gifts) {
      addIfSet(campaignIds, gt.CampaignId);
      addIfSet(donorIds, gt.DonorId);
      addIfSet(commitmentIds, gt.GiftCommitmentId);
    }
    Map<Id, String> campaigns = campaignNames(campaignIds);
    Map<Id, String> donors = accountNames(donorIds);
    Map<Id, String> commitmentCauses = topDefaultCause(commitmentIds);
    Datetime now = Datetime.now();
    for (GiftTransaction gt : gifts) {
      gt.Name = build(
        campaigns.get(gt.CampaignId),
        commitmentCauses.get(gt.GiftCommitmentId),
        donors.get(gt.DonorId),
        gt.TransactionDate,
        now
      );
    }
  }

  /** Names new commitments; the cause follows when its default designation is added. */
  public static void nameNewCommitments(List<GiftCommitment> commitments) {
    Set<Id> campaignIds = new Set<Id>();
    Set<Id> donorIds = new Set<Id>();
    for (GiftCommitment gc : commitments) {
      addIfSet(campaignIds, gc.CampaignId);
      addIfSet(donorIds, gc.DonorId);
    }
    Map<Id, String> campaigns = campaignNames(campaignIds);
    Map<Id, String> donors = accountNames(donorIds);
    Datetime now = Datetime.now();
    for (GiftCommitment gc : commitments) {
      gc.Name = build(
        campaigns.get(gc.CampaignId),
        null,
        donors.get(gc.DonorId),
        gc.EffectiveStartDate,
        now
      );
    }
  }

  // ---------------------------------------------------------------- after a cause changes

  /** Re-names gifts after their designations were added, changed or removed. */
  public static void renameGifts(Set<Id> giftIds) {
    giftIds.remove(null);
    if (giftIds.isEmpty()) {
      return;
    }
    List<GiftTransaction> gifts = [
      SELECT
        Id,
        Name,
        Campaign.Name,
        Donor.Name,
        TransactionDate,
        CreatedDate,
        GiftCommitmentId
      FROM GiftTransaction
      WHERE Id IN :giftIds
    ];
    Map<Id, String> causes = new Map<Id, String>();
    for (GiftTransactionDesignation gtd : [
      SELECT GiftTransactionId, GiftDesignation.Name
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId IN :giftIds AND GiftDesignationId != NULL
      ORDER BY Percent DESC NULLS LAST, CreatedDate ASC
    ]) {
      if (!causes.containsKey(gtd.GiftTransactionId)) {
        causes.put(gtd.GiftTransactionId, gtd.GiftDesignation.Name);
      }
    }
    Set<Id> commitmentIds = new Set<Id>();
    for (GiftTransaction gt : gifts) {
      if (!causes.containsKey(gt.Id)) {
        addIfSet(commitmentIds, gt.GiftCommitmentId);
      }
    }
    Map<Id, String> commitmentCauses = topDefaultCause(commitmentIds);
    List<GiftTransaction> changed = new List<GiftTransaction>();
    for (GiftTransaction gt : gifts) {
      String cause = causes.containsKey(gt.Id)
        ? causes.get(gt.Id)
        : commitmentCauses.get(gt.GiftCommitmentId);
      String name = build(
        gt.Campaign?.Name,
        cause,
        gt.Donor?.Name,
        gt.TransactionDate,
        gt.CreatedDate
      );
      if (gt.Name != name) {
        changed.add(new GiftTransaction(Id = gt.Id, Name = name));
      }
    }
    update changed;
  }

  /** Re-names commitments after their default designations were added, changed or removed. */
  public static void renameCommitments(Set<Id> parentIds) {
    Set<Id> commitmentIds = new Set<Id>();
    for (Id parentId : parentIds) {
      if (
        parentId != null &&
        parentId.getSobjectType() == GiftCommitment.SObjectType
      ) {
        commitmentIds.add(parentId);
      }
    }
    if (commitmentIds.isEmpty()) {
      return;
    }
    Map<Id, String> causes = topDefaultCause(commitmentIds);
    List<GiftCommitment> changed = new List<GiftCommitment>();
    for (GiftCommitment gc : [
      SELECT
        Id,
        Name,
        Campaign.Name,
        Donor.Name,
        EffectiveStartDate,
        CreatedDate
      FROM GiftCommitment
      WHERE Id IN :commitmentIds
    ]) {
      String name = build(
        gc.Campaign?.Name,
        causes.get(gc.Id),
        gc.Donor?.Name,
        gc.EffectiveStartDate,
        gc.CreatedDate
      );
      if (gc.Name != name) {
        changed.add(new GiftCommitment(Id = gc.Id, Name = name));
      }
    }
    update changed;
  }

  // ---------------------------------------------------------------- lookups

  static Map<Id, String> topDefaultCause(Set<Id> parentIds) {
    Map<Id, String> causes = new Map<Id, String>();
    if (parentIds.isEmpty()) {
      return causes;
    }
    for (GiftDefaultDesignation gdd : [
      SELECT ParentRecordId, GiftDesignation.Name
      FROM GiftDefaultDesignation
      WHERE ParentRecordId IN :parentIds
      ORDER BY AllocatedPercentage DESC NULLS LAST, CreatedDate ASC
    ]) {
      if (!causes.containsKey(gdd.ParentRecordId)) {
        causes.put(gdd.ParentRecordId, gdd.GiftDesignation.Name);
      }
    }
    return causes;
  }

  static Map<Id, String> campaignNames(Set<Id> ids) {
    Map<Id, String> names = new Map<Id, String>();
    if (!ids.isEmpty()) {
      for (Campaign c : [SELECT Id, Name FROM Campaign WHERE Id IN :ids]) {
        names.put(c.Id, c.Name);
      }
    }
    return names;
  }

  static Map<Id, String> accountNames(Set<Id> ids) {
    Map<Id, String> names = new Map<Id, String>();
    if (!ids.isEmpty()) {
      for (Account a : [SELECT Id, Name FROM Account WHERE Id IN :ids]) {
        names.put(a.Id, a.Name);
      }
    }
    return names;
  }

  static void addIfSet(Set<Id> ids, Id value) {
    if (value != null) {
      ids.add(value);
    }
  }
}
