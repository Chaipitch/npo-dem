/**
 * LWC entry points for the donation journey on the ABC Hope site.
 * The only Apex class the site guest profile is granted access to.
 */
public without sharing class DonationIntakeController {
  @AuraEnabled(cacheable=true)
  public static DonationIntakeService.Options getOptions(
    String campaignName,
    String designationNames
  ) {
    try {
      return DonationIntakeService.getOptions(campaignName, designationNames);
    } catch (DonationIntakeService.DonationException e) {
      throw auraError(e.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<DonationIntakeService.CampaignCard> getCampaigns() {
    return DonationIntakeService.getCampaigns();
  }

  @AuraEnabled(cacheable=true)
  public static List<DonationIntakeService.ProgramCard> getPrograms() {
    return DonationIntakeService.getPrograms();
  }

  @AuraEnabled(cacheable=true)
  public static DonationIntakeService.CampaignDetail getCampaignDetail(
    String campaignName
  ) {
    return DonationIntakeService.getCampaignDetail(campaignName);
  }

  @AuraEnabled
  public static DonationIntakeService.Result submitDonation(
    String requestJson
  ) {
    DonationIntakeService.Request req;
    try {
      req = (DonationIntakeService.Request) JSON.deserializeStrict(
        requestJson,
        DonationIntakeService.Request.class
      );
    } catch (Exception e) {
      throw auraError('Missing donation details.');
    }
    try {
      return DonationIntakeService.submit(req);
    } catch (DonationIntakeService.DonationException e) {
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
