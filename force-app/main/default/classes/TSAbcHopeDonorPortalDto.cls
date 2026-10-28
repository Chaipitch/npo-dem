/**
 * Data shapes the signed-in donor portal sends to the site (D-51): dashboard, gifts, giving history pages,
 * impact journey, profile and recurring gift results. Built by TSAbcHopeDonorPortalService.
 */
public with sharing class TSAbcHopeDonorPortalDto {
  public class Gift {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Date giftDate;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String campaignName;
    @AuraEnabled
    public String designations;
    @AuraEnabled
    public String programs; // what the designations fund (D-21)
  }

  /** One page of the giving history (D-49): fetched a page at a time, newest first. */
  public class GivingPage {
    @AuraEnabled
    public List<Gift> gifts = new List<Gift>();
    @AuraEnabled
    public Integer total = 0;
    @AuraEnabled
    public Integer page = 1;
    @AuraEnabled
    public Integer pageSize;
  }

  public class Milestone {
    @AuraEnabled
    public String year;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String kind;
  }

  /** One year of the donor's impact journey: what they gave, cause by cause (D-35). */
  public class JourneyYear {
    @AuraEnabled
    public String year;
    @AuraEnabled
    public Decimal total = 0;
    @AuraEnabled
    public Integer giftCount = 0;
    @AuraEnabled
    public Boolean joined = false; // the year they became a supporter
    @AuraEnabled
    public List<JourneyItem> items = new List<JourneyItem>();
  }

  public class JourneyItem {
    @AuraEnabled
    public String cause;
    @AuraEnabled
    public String program;
    @AuraEnabled
    public Decimal amount = 0;
    @AuraEnabled
    public Integer giftCount = 0;
    @AuraEnabled
    public Boolean isNew = false; // first year they supported this cause
    @AuraEnabled
    public Boolean recurringOnly = false; // an active recurring gift with no payment yet
  }

  public class Dashboard {
    @AuraEnabled
    public String donorName;
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public Decimal totalContributions = 0;
    @AuraEnabled
    public Integer causesSupported = 0;
    @AuraEnabled
    public String supporterSince;
    @AuraEnabled
    public Integer activeMonthlyGifts = 0; // open and not paused
    @AuraEnabled
    public Integer pausedMonthlyGifts = 0; // current or upcoming pause (D-22)
    // Org-wide figures for the Shared impact tiles ("{programs}", "{peopleReached}", "{communities}",
    // "{volunteers}"). Reach figures are the sums of the Program fields the team keeps up to date (D-34).
    @AuraEnabled
    public Integer activePrograms = 0; // active Programs
    @AuraEnabled
    public Integer peopleReached = 0; // sum of People_Reached__c on active Programs
    @AuraEnabled
    public Integer communities = 0; // sum of Communities__c on active Programs
    @AuraEnabled
    public Integer volunteersEngaged = 0; // sum of Volunteers_Engaged__c on active Programs
    @AuraEnabled
    public Date pausedUntil; // earliest pause end among paused gifts
    @AuraEnabled
    public List<String> activeRecurringTypes = new List<String>(); // e.g. Weekly, Monthly (D-24)
    @AuraEnabled
    public List<String> causes = new List<String>();
    /** The most recent counted gifts only (RECENT_GIFTS); the full history is paged by getGivingPage. */
    @AuraEnabled
    public List<Gift> gifts = new List<Gift>();
    /** Number of counted gifts (up to the 200 the summary reads). */
    @AuraEnabled
    public Integer giftCount = 0;
    /** Programs the donor's counted gifts fund, A–Z. */
    @AuraEnabled
    public List<String> programs = new List<String>();
    /** True when a counted gift has a cause that funds no program (for the agent's summary). */
    public Boolean causeWithoutProgram = false;
    @AuraEnabled
    public List<Milestone> journey = new List<Milestone>();
    /** The journey as one card per year, oldest first. */
    @AuraEnabled
    public List<JourneyYear> journeyYears = new List<JourneyYear>();
  }

  public class Profile {
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public String lastName;
    @AuraEnabled
    public String email;
    @AuraEnabled
    public String phone;
    @AuraEnabled
    public String street;
    @AuraEnabled
    public String city;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public Boolean emailOptOut;
    @AuraEnabled
    public String donorSince;
  }

  public class MonthlyGiftsResult {
    @AuraEnabled
    public String message;
    @AuraEnabled
    public List<TSAbcHopeMonthlyGiftDto.Gift> gifts;
  }
}
