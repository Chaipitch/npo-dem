/**
 * Dashboard "Ask About Your Journey" panel → ABC Hope Donor Assistant, inline (spike, see Handover).
 * Sends the signed-in donor's message to the agent through the standard generateAiAgentResponse
 * invocable action and returns the reply text. The agent session continues across messages.
 *
 * Signed-in portal users only. The donor's identity is not yet passed to the agent: personal
 * questions get the agent's "please sign in" answer until the verified-identity path is built.
 */
public with sharing class DonorAgentController {
  static final String AGENT = 'ABC_Hope_Donor_Assistant';
  static final Integer MAX_MESSAGE = 1000;

  public class Reply {
    @AuraEnabled
    public String sessionId;
    @AuraEnabled
    public String text;
    @AuraEnabled
    public String error;
    @AuraEnabled
    public String diagnostic; // spike only: caller user type and any technical error
  }

  @AuraEnabled
  public static Reply ask(String message, String sessionId) {
    Reply r = new Reply();
    r.diagnostic = 'caller=' + UserInfo.getUserType();
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
      Invocable.Action action = Invocable.Action.createCustomAction(
        'generateAiAgentResponse',
        AGENT
      );
      action.setInvocationParameter('userMessage', text);
      if (String.isNotBlank(sessionId)) {
        action.setInvocationParameter('sessionId', sessionId);
      }
      Invocable.Action.Result result = action.invoke()[0];
      if (!result.isSuccess()) {
        r.error = 'The assistant could not answer right now. Please try again.';
        r.diagnostic +=
          ' errors=' + String.valueOf(result.getErrors()).left(500);
        return r;
      }
      Map<String, Object> out = result.getOutputParameters();
      r.sessionId = (String) out.get('sessionId');
      r.text = replyText(out.get('agentResponse'));
    } catch (Exception e) {
      r.error = 'The assistant could not answer right now. Please try again.';
      r.diagnostic +=
        ' exception=' +
        e.getTypeName() +
        ': ' +
        e.getMessage().left(500);
    }
    return r;
  }

  /** agentResponse is JSON like {"type":"Text","value":"…"}; fall back to the raw string. */
  @TestVisible
  static String replyText(Object raw) {
    String s = raw == null ? '' : String.valueOf(raw);
    try {
      Object parsed = JSON.deserializeUntyped(s);
      if (parsed instanceof Map<String, Object>) {
        Object value = ((Map<String, Object>) parsed).get('value');
        if (value != null) {
          return String.valueOf(value);
        }
      }
    } catch (JSONException e) {
      // not JSON: use as is
    }
    return s;
  }
}
