/**
 * Read side of the ABC Hope site (D-51): open campaigns and their cards, campaign and program detail pages, Our Work
 * programs with live figures, and the About page totals. Safe for guests: reads only, no personal data.
 * Called by TSAbcHopeDonationIntakeController and the agent's campaign action; data shapes are in TSAbcHopeCampaignDto.
 */
public without sharing class TSAbcHopeCampaignService {
  /**
   * Campaigns open for donations: active, not ended, and set up with at least one
   * default designation (that is what marks a campaign as a fundraising campaign here).
   * Raised = sum of non-cancelled gift transactions attributed to the campaign.
   * Programs = what the campaign spends the money on, via each designation's Program (D-21).
   */
  public static List<TSAbcHopeCampaignDto.CampaignCard> getCampaigns() {
    Date today = Date.today();
    Map<Id, TSAbcHopeCampaignDto.CampaignCard> cards = new Map<Id, TSAbcHopeCampaignDto.CampaignCard>();
    Set<Id> withDefaults = new Set<Id>();
    Map<Id, List<String>> designationsByCampaign = new Map<Id, List<String>>();
    Map<Id, List<String>> programsByCampaign = new Map<Id, List<String>>();
    for (GiftDefaultDesignation gdd : [
      SELECT
        ParentRecordId,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name
      FROM GiftDefaultDesignation
      WHERE
        ParentRecordId IN (
          SELECT Id
          FROM Campaign
          WHERE IsActive = TRUE AND (EndDate = NULL OR EndDate >= :today)
        )
        AND GiftDesignation.IsActive = TRUE
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
    ]) {
      withDefaults.add(gdd.ParentRecordId);
      if (!designationsByCampaign.containsKey(gdd.ParentRecordId)) {
        designationsByCampaign.put(gdd.ParentRecordId, new List<String>());
      }
      designationsByCampaign.get(gdd.ParentRecordId)
        .add(gdd.GiftDesignation.Name);
      addProgram(
        programsByCampaign,
        gdd.ParentRecordId,
        gdd.GiftDesignation.NGOTV_Program__r?.Name
      );
    }
    for (Campaign c : [
      SELECT Id, Name, Description, Image_URL__c, EndDate, ExpectedRevenue
      FROM Campaign
      WHERE Id IN :withDefaults
      ORDER BY EndDate ASC NULLS LAST, Name
      LIMIT 12
    ]) {
      TSAbcHopeCampaignDto.CampaignCard card = new TSAbcHopeCampaignDto.CampaignCard();
      card.id = c.Id;
      card.name = c.Name;
      card.description = c.Description;
      card.imageUrl = c.Image_URL__c;
      card.endDate = c.EndDate;
      card.daysLeft = c.EndDate == null ? null : today.daysBetween(c.EndDate);
      card.goal = c.ExpectedRevenue;
      card.designations = designationsByCampaign.get(c.Id);
      if (programsByCampaign.containsKey(c.Id)) {
        card.programs = programsByCampaign.get(c.Id);
      }
      cards.put(c.Id, card);
    }
    for (AggregateResult ar : [
      SELECT CampaignId cid, SUM(OriginalAmount) total, COUNT(Id) n
      FROM GiftTransaction
      WHERE
        CampaignId IN :cards.keySet()
        AND Status NOT IN (
          'Canceled',
          'Failed',
          'Fully Refunded',
          'Written-Off'
        )
      GROUP BY CampaignId
    ]) {
      TSAbcHopeCampaignDto.CampaignCard card = cards.get((Id) ar.get('cid'));
      card.raised = (Decimal) ar.get('total') == null
        ? 0
        : (Decimal) ar.get('total');
      card.giftCount = (Integer) ar.get('n');
    }
    return cards.values();
  }

  public static TSAbcHopeCampaignDto.Impact getImpact() {
    AggregateResult reach = [
      SELECT
        COUNT(Id) programs,
        SUM(People_Reached__c) people,
        SUM(Communities__c) communities,
        SUM(Volunteers_Engaged__c) volunteers
      FROM Program
      WHERE Status = 'Active'
    ];
    TSAbcHopeCampaignDto.Impact i = new TSAbcHopeCampaignDto.Impact();
    i.programs = (Integer) reach.get('programs');
    i.peopleReached = wholeNumber(reach.get('people'));
    i.communities = wholeNumber(reach.get('communities'));
    i.volunteers = wholeNumber(reach.get('volunteers'));
    return i;
  }

  static Integer wholeNumber(Object value) {
    return value == null ? 0 : ((Decimal) value).intValue();
  }

  /** One active program by name (the /program page), or null. */
  public static TSAbcHopeCampaignDto.ProgramCard getProgramDetail(
    String programName
  ) {
    String name = String.isBlank(programName) ? '' : programName.trim();
    for (TSAbcHopeCampaignDto.ProgramCard c : getPrograms()) {
      if (c.name.equalsIgnoreCase(name)) {
        return c;
      }
    }
    return null;
  }

  /**
   * Active programs (D-21), each with the open campaigns (D-18) and active causes that fund it.
   * Programs funding an open campaign come first, then the rest, each group by name.
   */
  public static List<TSAbcHopeCampaignDto.ProgramCard> getPrograms() {
    Map<Id, TSAbcHopeCampaignDto.ProgramCard> byId = new Map<Id, TSAbcHopeCampaignDto.ProgramCard>();
    for (Program p : [
      SELECT Id, Name, Summary, Image_URL__c, People_Reached__c
      FROM Program
      WHERE Status = 'Active'
      ORDER BY Name
      LIMIT 50
    ]) {
      TSAbcHopeCampaignDto.ProgramCard c = new TSAbcHopeCampaignDto.ProgramCard();
      c.name = p.Name;
      c.summary = p.Summary;
      c.imageUrl = p.Image_URL__c;
      c.peopleReached = wholeNumber(p.People_Reached__c);
      byId.put(p.Id, c);
    }
    if (byId.isEmpty()) {
      return new List<TSAbcHopeCampaignDto.ProgramCard>();
    }
    Map<Id, String> openCampaigns = new Map<Id, String>();
    for (TSAbcHopeCampaignDto.CampaignCard card : getCampaigns()) {
      openCampaigns.put(card.id, card.name);
    }
    for (GiftDefaultDesignation gdd : [
      SELECT
        ParentRecordId,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__c
      FROM GiftDefaultDesignation
      WHERE
        ParentRecordId IN :openCampaigns.keySet()
        AND GiftDesignation.IsActive = TRUE
        AND GiftDesignation.NGOTV_Program__c IN :byId.keySet()
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
    ]) {
      TSAbcHopeCampaignDto.ProgramCard c = byId.get(
        gdd.GiftDesignation.NGOTV_Program__c
      );
      String campaign = openCampaigns.get(gdd.ParentRecordId);
      if (!c.campaigns.contains(campaign)) {
        c.campaigns.add(campaign);
      }
      if (!c.causes.contains(gdd.GiftDesignation.Name)) {
        c.causes.add(gdd.GiftDesignation.Name);
      }
    }
    addProgramFigures(byId);
    List<TSAbcHopeCampaignDto.ProgramCard> funded = new List<TSAbcHopeCampaignDto.ProgramCard>();
    List<TSAbcHopeCampaignDto.ProgramCard> others = new List<TSAbcHopeCampaignDto.ProgramCard>();
    for (TSAbcHopeCampaignDto.ProgramCard c : byId.values()) {
      (c.campaigns.isEmpty() ? others : funded).add(c);
    }
    funded.addAll(others);
    return funded;
  }

  /**
   * Money raised (Paid gifts through cause → program), people enrolled and quantities delivered (D-33).
   * Nothing is stored on Program: every figure is added up from the records each time.
   */
  @TestVisible
  static String raisedStatus = 'Paid'; // tests can't save Paid gifts (see giftStatus)

  static void addProgramFigures(
    Map<Id, TSAbcHopeCampaignDto.ProgramCard> byId
  ) {
    Set<Id> ids = byId.keySet();
    for (AggregateResult ar : [
      SELECT
        GiftDesignation.NGOTV_Program__c programId,
        SUM(Amount) amount,
        COUNT_DISTINCT(GiftTransaction.DonorId) donors
      FROM GiftTransactionDesignation
      WHERE
        GiftTransaction.Status = :raisedStatus
        AND GiftDesignation.NGOTV_Program__c IN :ids
      GROUP BY GiftDesignation.NGOTV_Program__c
    ]) {
      TSAbcHopeCampaignDto.ProgramCard c = byId.get((Id) ar.get('programId'));
      c.raised = (Decimal) ar.get('amount') ?? 0;
      c.donorCount = (Integer) ar.get('donors');
    }
    for (AggregateResult ar : [
      SELECT
        BenefitAssignment.Benefit.ProgramId programId,
        BenefitAssignment.Benefit.Name benefit,
        BenefitAssignment.Benefit.Unit.Name unit,
        SUM(DisbursedQuantity) quantity
      FROM BenefitDisbursement
      WHERE
        BenefitAssignment.Benefit.ProgramId IN :ids
        AND DisbursementStatus IN ('Disbursed', 'Completed')
      GROUP BY
        BenefitAssignment.Benefit.ProgramId,
        BenefitAssignment.Benefit.Name,
        BenefitAssignment.Benefit.Unit.Name
      ORDER BY SUM(DisbursedQuantity) DESC
    ]) {
      Decimal quantity = (Decimal) ar.get('quantity');
      if (quantity == null || quantity <= 0) {
        continue;
      }
      TSAbcHopeCampaignDto.Delivery d = new TSAbcHopeCampaignDto.Delivery();
      d.benefit = (String) ar.get('benefit');
      d.quantity = quantity;
      d.unit = (String) ar.get('unit');
      byId.get((Id) ar.get('programId')).deliveries.add(d);
    }
  }

  /**
   * Detail page for one campaign that is open for donations (same rule as the cards, D-18):
   * its card facts plus the causes donors can choose and the programs they fund (D-21).
   * Returns null for unknown or closed campaigns.
   */
  public static TSAbcHopeCampaignDto.CampaignDetail getCampaignDetail(
    String campaignName
  ) {
    String name = clean(campaignName, 80);
    if (String.isBlank(name)) {
      return null;
    }
    TSAbcHopeCampaignDto.CampaignCard card;
    for (TSAbcHopeCampaignDto.CampaignCard c : getCampaigns()) {
      if (c.name == name) {
        card = c;
      }
    }
    if (card == null) {
      return null;
    }
    TSAbcHopeCampaignDto.CampaignDetail d = new TSAbcHopeCampaignDto.CampaignDetail();
    d.card = card;
    d.startDate = [SELECT StartDate FROM Campaign WHERE Id = :card.id]
    .StartDate;
    Set<String> seenPrograms = new Set<String>();
    for (GiftDefaultDesignation gdd : [
      SELECT
        GiftDesignation.Name,
        GiftDesignation.Description,
        GiftDesignation.NGOTV_Program__r.Name,
        GiftDesignation.NGOTV_Program__r.Summary
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :card.id AND GiftDesignation.IsActive = TRUE
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
    ]) {
      TSAbcHopeCampaignDto.CampaignCause cause = new TSAbcHopeCampaignDto.CampaignCause();
      cause.name = gdd.GiftDesignation.Name;
      cause.description = gdd.GiftDesignation.Description;
      cause.program = gdd.GiftDesignation.NGOTV_Program__r?.Name;
      d.causes.add(cause);
      if (cause.program != null && seenPrograms.add(cause.program)) {
        TSAbcHopeCampaignDto.CampaignProgram p = new TSAbcHopeCampaignDto.CampaignProgram();
        p.name = cause.program;
        p.summary = gdd.GiftDesignation.NGOTV_Program__r.Summary;
        d.programs.add(p);
      }
    }
    return d;
  }

  /** Adds a program name to the record's list once; designations without a program are skipped. */
  public static void addProgram(
    Map<Id, List<String>> programsById,
    Id recordId,
    String programName
  ) {
    if (String.isBlank(programName)) {
      return;
    }
    if (!programsById.containsKey(recordId)) {
      programsById.put(recordId, new List<String>());
    }
    if (!programsById.get(recordId).contains(programName)) {
      programsById.get(recordId).add(programName);
    }
  }

  static String clean(String value, Integer maxLength) {
    return value == null
      ? null
      : value.normalizeSpace().stripHtmlTags().abbreviate(maxLength);
  }
}
