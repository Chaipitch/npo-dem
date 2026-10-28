/**
 * Data shapes for recurring gifts (D-22, D-51): what the My Giving cards show and the result of a change.
 * Logic lives in TSAbcHopeMonthlyGiftService.
 */
public with sharing class TSAbcHopeMonthlyGiftDto {
  public class Gift {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal amount;
    /** Schedule period: Weekly, Monthly or Yearly (D-24); older schedules may say Custom. */
    @AuraEnabled
    public String period;
    @AuraEnabled
    public String designation;
    @AuraEnabled
    public String program;
    @AuraEnabled
    public String campaignName;
    @AuraEnabled
    public Boolean isPaused = false;
    @AuraEnabled
    public Date pausedFrom;
    @AuraEnabled
    public Date pausedUntil;
    @AuraEnabled
    public Date nextGiftDate;

    public GiftCommitment commitment;
    public GiftCommitmentSchedule openSchedule; // open-ended CreateTransactions schedule
    public GiftCommitmentSchedule pauseSchedule; // current or upcoming pause
  }

  public class Outcome {
    public Boolean success = false;
    public String message;
    public Outcome(Boolean success, String message) {
      this.success = success;
      this.message = message;
    }
  }
}
