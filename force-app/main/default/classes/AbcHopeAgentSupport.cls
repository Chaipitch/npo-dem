/**
 * Shared helpers for the ABC Hope Donor Assistant (Agentforce) actions.
 *
 * Identity rule: a chat is tied to a donor ONLY through MessagingEndUser.AuthenticatedEndUserId,
 * which Salesforce sets when the site user is verified. Contact links created from pre-chat
 * input (e.g. a typed email) are ignored, so a guest can never read or change someone else's data.
 */
public without sharing class AbcHopeAgentSupport {
  public static final String CURRENCY_LABEL = 'THB';

  @TestVisible
  static Id accountIdOverride; // lets tests simulate a verified donor without a messaging session

  public static Id verifiedAccountId(String messagingSessionId) {
    if (accountIdOverride != null) {
      return accountIdOverride;
    }
    Id sessionId = toId(messagingSessionId);
    if (
      sessionId == null ||
      sessionId.getSobjectType() != MessagingSession.SObjectType
    ) {
      return null;
    }
    List<MessagingSession> sessions = [
      SELECT MessagingEndUser.AuthenticatedEndUserId
      FROM MessagingSession
      WHERE Id = :sessionId
      LIMIT 1
    ];
    if (
      sessions.isEmpty() ||
      sessions[0].MessagingEndUser?.AuthenticatedEndUserId == null
    ) {
      return null;
    }
    for (User u : [
      SELECT Contact.AccountId
      FROM User
      WHERE
        Id = :sessions[0].MessagingEndUser.AuthenticatedEndUserId
        AND IsActive = TRUE
        AND ContactId != NULL
      LIMIT 1
    ]) {
      return u.Contact.AccountId;
    }
    return null;
  }

  public static String money(Decimal amount) {
    Decimal value = amount == null
      ? 0
      : amount.setScale(0, RoundingMode.HALF_UP);
    return CURRENCY_LABEL + ' ' + value.format();
  }

  public static String siteUrl(String path) {
    for (DomainSite ds : [
      SELECT Domain.Domain, PathPrefix
      FROM DomainSite
      WHERE Site.Name = 'ABC_Hope1'
      LIMIT 1
    ]) {
      String prefix = String.isBlank(ds.PathPrefix) || ds.PathPrefix == '/'
        ? ''
        : ds.PathPrefix;
      return 'https://' + ds.Domain.Domain + prefix + path;
    }
    return path;
  }

  public static String clean(String value, Integer maxLength) {
    return value == null
      ? null
      : value.normalizeSpace().stripHtmlTags().abbreviate(maxLength);
  }

  static Id toId(String value) {
    if (String.isBlank(value)) {
      return null;
    }
    try {
      return Id.valueOf(value.trim());
    } catch (Exception e) {
      return null;
    }
  }
}
