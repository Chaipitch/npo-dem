/**
 * Signed-in donor portal on the ABC Hope site (D-51): the @AuraEnabled entry points for the dashboard, giving
 * history, profile and recurring gifts. Logic is in TSAbcHopeDonorPortalService (every query is scoped to the
 * running user's own Account); data shapes are in TSAbcHopeDonorPortalDto. A PortalException becomes an
 * AuraHandledException so the site shows its message.
 */
public without sharing class TSAbcHopeDonorPortalController {
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonorPortalDto.Dashboard getDashboard() {
    try {
      return TSAbcHopeDonorPortalService.getDashboard();
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  /** One page of the signed-in donor's giving history (D-49). */
  @AuraEnabled(cacheable=true)
  public static TSAbcHopeDonorPortalDto.GivingPage getGivingPage(Integer page) {
    try {
      return TSAbcHopeDonorPortalService.getGivingPage(page);
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  @AuraEnabled
  public static TSAbcHopeDonorPortalDto.Profile getProfile() {
    try {
      return TSAbcHopeDonorPortalService.getProfile();
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  @AuraEnabled
  public static TSAbcHopeDonorPortalDto.Profile saveProfile(
    String profileJson
  ) {
    TSAbcHopeDonorPortalDto.Profile p;
    try {
      p = (TSAbcHopeDonorPortalDto.Profile) JSON.deserialize(
        profileJson,
        TSAbcHopeDonorPortalDto.Profile.class
      );
    } catch (Exception e) {
      throw auraError('Invalid profile details.');
    }
    try {
      return TSAbcHopeDonorPortalService.saveProfile(p);
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  @AuraEnabled
  public static List<TSAbcHopeMonthlyGiftDto.Gift> getMonthlyGifts() {
    try {
      return TSAbcHopeDonorPortalService.getMonthlyGifts();
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  /** Pause, resume, change or cancel one of the signed-in donor's own recurring gifts. */
  @AuraEnabled
  public static TSAbcHopeDonorPortalDto.MonthlyGiftsResult manageMonthlyGift(
    String giftId,
    String operation,
    Integer pauseMonths,
    Decimal newAmount
  ) {
    try {
      return TSAbcHopeDonorPortalService.manageMonthlyGift(
        giftId,
        operation,
        pauseMonths,
        newAmount
      );
    } catch (TSAbcHopeDonorPortalService.PortalException e) {
      throw auraError(e.getMessage());
    }
  }

  static AuraHandledException auraError(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}
