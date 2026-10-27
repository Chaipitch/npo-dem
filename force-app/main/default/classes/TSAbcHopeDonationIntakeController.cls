/**
 * LWC entry points for the donation journey on the ABC Hope site.
 * The only Apex class the site guest profile is granted access to.
 */
public without sharing class TSAbcHopeDonationIntakeController {
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonationIntakeService.Options getOptions(
    String campaignName,
    String designationNames
  ) {
    try {
      return TSAbcHopeDonationIntakeService.getOptions(
        campaignName,
        designationNames
      );
    } catch (TSAbcHopeDonationIntakeService.DonationException e) {
      throw auraError(e.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<TSAbcHopeDonationIntakeService.CampaignCard> getCampaigns() {
    return TSAbcHopeDonationIntakeService.getCampaigns();
  }

  /** About page facts: totals over active programs (D-46). */
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonationIntakeService.Impact getImpact() {
    return TSAbcHopeDonationIntakeService.getImpact();
  }

  @AuraEnabled(cacheable=true)
  public static List<TSAbcHopeDonationIntakeService.ProgramCard> getPrograms() {
    return TSAbcHopeDonationIntakeService.getPrograms();
  }

  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonationIntakeService.ProgramCard getProgramDetail(
    String programName
  ) {
    return TSAbcHopeDonationIntakeService.getProgramDetail(programName);
  }

  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonationIntakeService.CampaignDetail getCampaignDetail(
    String campaignName
  ) {
    return TSAbcHopeDonationIntakeService.getCampaignDetail(campaignName);
  }

  @AuraEnabled
  public static TSAbcHopeDonationIntakeService.Result submitDonation(
    String requestJson
  ) {
    TSAbcHopeDonationIntakeService.Request req;
    try {
      req = (TSAbcHopeDonationIntakeService.Request) JSON.deserializeStrict(
        requestJson,
        TSAbcHopeDonationIntakeService.Request.class
      );
    } catch (Exception e) {
      throw auraError('Missing donation details.');
    }
    try {
      return TSAbcHopeDonationIntakeService.submit(req);
    } catch (TSAbcHopeDonationIntakeService.DonationException e) {
      throw auraError(e.getMessage());
    } catch (Exception e) {
      System.debug(
        LoggingLevel.ERROR,
        'Donation submit failed: ' +
          e.getMessage() +
          '\n' +
          e.getStackTraceString()
      );
      throw auraError(
        'Something went wrong saving your donation. Please try again.'
      );
    }
  }

  static AuraHandledException auraError(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}
