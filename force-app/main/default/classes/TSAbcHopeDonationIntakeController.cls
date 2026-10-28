/**
 * LWC entry points for the donation journey on the ABC Hope site.
 * The only Apex class the site guest profile is granted access to.
 */
public without sharing class TSAbcHopeDonationIntakeController {
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonationIntakeDto.Options getOptions(
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
  public static List<TSAbcHopeCampaignDto.CampaignCard> getCampaigns() {
    return TSAbcHopeCampaignService.getCampaigns();
  }

  /** About page facts: totals over active programs (D-46). */
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeCampaignDto.Impact getImpact() {
    return TSAbcHopeCampaignService.getImpact();
  }

  @AuraEnabled(cacheable=true)
  public static List<TSAbcHopeCampaignDto.ProgramCard> getPrograms() {
    return TSAbcHopeCampaignService.getPrograms();
  }

  @AuraEnabled(cacheable=true)
  public static TSAbcHopeCampaignDto.ProgramCard getProgramDetail(
    String programName
  ) {
    return TSAbcHopeCampaignService.getProgramDetail(programName);
  }

  @AuraEnabled(cacheable=true)
  public static TSAbcHopeCampaignDto.CampaignDetail getCampaignDetail(
    String campaignName
  ) {
    return TSAbcHopeCampaignService.getCampaignDetail(campaignName);
  }

  @AuraEnabled
  public static TSAbcHopeDonationIntakeDto.Result submitDonation(
    String requestJson
  ) {
    TSAbcHopeDonationIntakeDto.Request req;
    try {
      req = (TSAbcHopeDonationIntakeDto.Request) JSON.deserializeStrict(
        requestJson,
        TSAbcHopeDonationIntakeDto.Request.class
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
