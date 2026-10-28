/**
 * Dashboard "Ask About Your Journey" panel (D-23, D-51): the @AuraEnabled entry points. Signed-in portal users
 * only. Checks the user and the message, then asks TSAbcHopeDonorAgentService. Technical errors are logged,
 * never returned to the browser.
 */
public with sharing class TSAbcHopeDonorAgentController {
  static final Integer MAX_MESSAGE = 1000;
  static final String UNAVAILABLE = 'The assistant could not answer right now. Please try again.';

  /** Lets the panel send personal questions to the agent (verified donor) instead of answering them itself. */
  @AuraEnabled(cacheable=true)
  public static Boolean usesVerifiedAgent() {
    return TSAbcHopeDonorAgentService.USE_AGENT_API;
  }

  @AuraEnabled
  public static TSAbcHopeDonorAgentDto.Reply ask(
    String message,
    String sessionId
  ) {
    TSAbcHopeDonorAgentDto.Reply r = new TSAbcHopeDonorAgentDto.Reply();
    if (UserInfo.getUserType() == 'Guest') {
      r.error = 'Please sign in to chat with the ABC Hope assistant.';
      return r;
    }
    String text = message == null
      ? ''
      : message.normalizeSpace().stripHtmlTags().abbreviate(MAX_MESSAGE);
    if (String.isBlank(text)) {
      r.error = 'Please type a question.';
      return r;
    }
    try {
      return TSAbcHopeDonorAgentService.reply(text, sessionId);
    } catch (Exception e) {
      r.error = UNAVAILABLE;
      System.debug(
        LoggingLevel.ERROR,
        'Donor agent failed: ' + e.getTypeName() + ': ' + e.getMessage()
      );
    }
    return r;
  }
}
