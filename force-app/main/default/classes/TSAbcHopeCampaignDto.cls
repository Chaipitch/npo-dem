/**
 * Data shapes for campaigns and programs on the ABC Hope site (D-51): campaign cards and detail pages,
 * program cards with live figures, and the About page totals. Built by TSAbcHopeCampaignService.
 */
public with sharing class TSAbcHopeCampaignDto {
  public class CampaignCard {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public Date endDate;
    @AuraEnabled
    public Integer daysLeft;
    @AuraEnabled
    public Decimal goal;
    @AuraEnabled
    public Decimal raised = 0;
    @AuraEnabled
    public Integer giftCount = 0;
    @AuraEnabled
    public List<String> designations = new List<String>();
    @AuraEnabled
    public List<String> programs = new List<String>();
  }

  public class CampaignCause {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public String program;
  }

  public class CampaignProgram {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String summary;
  }

  /** Totals over active programs (D-34, D-46): the About page facts and the dashboard's shared impact. */
  public class Impact {
    @AuraEnabled
    public Integer programs = 0;
    @AuraEnabled
    public Integer peopleReached = 0;
    @AuraEnabled
    public Integer communities = 0; // a plain sum: a community served by two programs counts twice
    @AuraEnabled
    public Integer volunteers = 0;
  }

  /** "Our Work" page (D-26): an active program with the open campaigns and causes that fund it. */
  public class ProgramCard {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String summary;
    @AuraEnabled
    public List<String> campaigns = new List<String>();
    @AuraEnabled
    public List<String> causes = new List<String>();
    /** Paid gifts to the program's causes, in USD (D-33). */
    @AuraEnabled
    public Decimal raised = 0;
    @AuraEnabled
    public Integer donorCount = 0;
    /** The program's People Reached figure (People_Reached__c), as on the About page (D-46, D-47). */
    @AuraEnabled
    public Integer peopleReached = 0;
    /** Quantity delivered per benefit, largest first. */
    @AuraEnabled
    public List<Delivery> deliveries = new List<Delivery>();
  }

  public class Delivery {
    @AuraEnabled
    public String benefit;
    @AuraEnabled
    public Decimal quantity;
    @AuraEnabled
    public String unit;
  }

  public class CampaignDetail {
    @AuraEnabled
    public CampaignCard card;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public List<CampaignCause> causes = new List<CampaignCause>();
    @AuraEnabled
    public List<CampaignProgram> programs = new List<CampaignProgram>();
  }
}
