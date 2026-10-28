/**
 * Data shapes for the donation journey (D-51): the request the site sends, the result it shows, the cause
 * options and "Non specified" split shares, and the signed-in donor. Built by TSAbcHopeDonationIntakeService.
 */
public with sharing class TSAbcHopeDonationIntakeDto {
  public class Request {
    public String campaignName;
    public String frequency;
    public Decimal amount;
    public Id designationId;
    /** "Non specified" (D-48): no single cause; the gift is split across the campaign's causes. */
    public Boolean nonSpecified;
    public String donorType;
    public String firstName;
    public String lastName;
    public String organizationName;
    public String email;
    public String sourceCode;
  }

  public class Result {
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public String frequency;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String designationName;
    /** For a "Non specified" gift: how it was split, e.g. "Toys 34%, Books 33%, Games 33%". */
    @AuraEnabled
    public String splitSummary;
    @AuraEnabled
    public String donorName;
    @AuraEnabled
    public String donorEmail;
  }

  public class Donor {
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public String lastName;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String email;
  }

  public class Option {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String value;
    @AuraEnabled
    public String program;
    public Option(String label, String value, String program) {
      this.label = label;
      this.value = value;
      this.program = program;
    }
  }

  public class Options {
    @AuraEnabled
    public String campaignName;
    @AuraEnabled
    public String campaignDescription;
    @AuraEnabled
    public List<Option> designations = new List<Option>();
    @AuraEnabled
    public String defaultDesignationId;
    /** How a "Non specified" gift would be split; empty when the campaign has fewer than two causes (D-48). */
    @AuraEnabled
    public List<Share> split = new List<Share>();
    @AuraEnabled
    public Donor currentDonor;
  }

  /** One cause's part of a "Non specified" gift (D-48). */
  public class Share {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal percent;
    public Id designationId;
  }
}
