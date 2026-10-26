/**
 * Dashboard "Ask About Your Journey" panel → ABC Hope Donor Assistant, inline (D-23).
 *
 * Two paths, chosen by USE_AGENT_API:
 *  - false: the standard generateAiAgentResponse invocable action. Works today, but the agent
 *    cannot tell who is asking, so it only answers general questions (campaigns, programs, giving).
 *  - true: the Agent API through the ABC_Hope_Agent_API named credential (client credentials).
 *    The session is started with the agent variable verified_account_id = the running portal
 *    user's account, so the agent's personal actions can answer for this donor only.
 *
 * Signed-in portal users only. Technical errors are logged, never returned to the browser.
 */
public with sharing class DonorAgentController {
  /** True once the AgentApiPrincipal principal holds the app's client ID and secret (set 2026-10-26). */
  @TestVisible
  static Boolean USE_AGENT_API = true;

  static final String AGENT = 'ABC_Hope_Donor_Assistant';
  static final String NAMED_CREDENTIAL = 'callout:ABC_Hope_Agent_API';
  static final Integer MAX_MESSAGE = 1000;
  static final String UNAVAILABLE = 'The assistant could not answer right now. Please try again.';

  public class Reply {
    @AuraEnabled
    public String sessionId;
    @AuraEnabled
    public String text;
    @AuraEnabled
    public String error;
  }

  /** Lets the panel send personal questions to the agent (verified donor) instead of answering them itself. */
  @AuraEnabled(cacheable=true)
  public static Boolean usesVerifiedAgent() {
    return USE_AGENT_API;
  }

  @AuraEnabled
  public static Reply ask(String message, String sessionId) {
    Reply r = new Reply();
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
      if (USE_AGENT_API) {
        askAgentApi(text, sessionId, r);
      } else {
        askInvocable(text, sessionId, r);
      }
    } catch (Exception e) {
      r.text = null;
      r.error = UNAVAILABLE;
      System.debug(
        LoggingLevel.ERROR,
        'Donor agent failed: ' + e.getTypeName() + ': ' + e.getMessage()
      );
    }
    return r;
  }

  // ---------------------------------------------------------------- invocable path (general questions)

  static void askInvocable(String text, String sessionId, Reply r) {
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
      throw new AgentException(String.valueOf(result.getErrors()));
    }
    Map<String, Object> out = result.getOutputParameters();
    r.sessionId = (String) out.get('sessionId');
    r.text = replyText(out.get('agentResponse'));
  }

  // ---------------------------------------------------------------- Agent API path (verified donor)

  public class AgentException extends Exception {
  }

  static void askAgentApi(String text, String sessionId, Reply r) {
    String sid = sessionId;
    if (String.isBlank(sid)) {
      Id accountId = new Directory().currentAccountId();
      if (accountId == null) {
        r.error = 'Please sign in to chat with the ABC Hope assistant.';
        return;
      }
      sid = startSession(accountId);
    }
    r.sessionId = sid;
    r.text = sendMessage(sid, text);
  }

  /** Starts an Agent API session for this donor; returns the session Id. */
  @TestVisible
  static String startSession(Id accountId) {
    Map<String, Object> body = new Map<String, Object>{
      'externalSessionKey' => UUID.randomUUID().toString(),
      'instanceConfig' => new Map<String, Object>{
        'endpoint' => URL.getOrgDomainUrl().toExternalForm()
      },
      'streamingCapabilities' => new Map<String, Object>{
        'chunkTypes' => new List<String>{ 'Text' }
      },
      'bypassUser' => true,
      'variables' => new List<Object>{
        new Map<String, Object>{
          'name' => 'verified_account_id',
          'type' => 'Text',
          'value' => String.valueOf(accountId)
        }
      }
    };
    Map<String, Object> res = call(
      'POST',
      '/einstein/ai-agent/v1/agents/' + new Directory().agentId() + '/sessions',
      body
    );
    String sid = (String) res.get('sessionId');
    if (String.isBlank(sid)) {
      throw new AgentException('Agent API returned no sessionId');
    }
    return sid;
  }

  /** Sends one message in the session and returns the agent's reply text. */
  @TestVisible
  static String sendMessage(String sessionId, String text) {
    Map<String, Object> body = new Map<String, Object>{
      'message' => new Map<String, Object>{
        'sequenceId' => Datetime.now().getTime(),
        'type' => 'Text',
        'text' => text
      }
    };
    Map<String, Object> res = call(
      'POST',
      '/einstein/ai-agent/v1/sessions/' +
        EncodingUtil.urlEncode(sessionId, 'UTF-8') +
        '/messages',
      body
    );
    List<String> parts = new List<String>();
    for (Object m : (List<Object>) res.get('messages')) {
      Map<String, Object> msg = (Map<String, Object>) m;
      Object value = msg.get('message');
      if (value != null && String.isNotBlank(String.valueOf(value))) {
        parts.add(String.valueOf(value));
      }
    }
    if (parts.isEmpty()) {
      throw new AgentException('Agent API returned no message text');
    }
    return String.join(parts, '\n\n');
  }

  static Map<String, Object> call(
    String method,
    String path,
    Map<String, Object> body
  ) {
    HttpRequest req = new HttpRequest();
    req.setEndpoint(NAMED_CREDENTIAL + path);
    req.setMethod(method);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Accept', 'application/json');
    req.setTimeout(60000);
    req.setBody(JSON.serialize(body));
    HttpResponse res = new Http().send(req);
    if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
      throw new AgentException(
        'Agent API ' +
          method +
          ' ' +
          path +
          ' -> ' +
          res.getStatusCode() +
          ' ' +
          res.getBody().left(300)
      );
    }
    return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
  }

  /** Lookups the portal user cannot run with sharing (setup objects, own contact link). */
  without sharing class Directory {
    Id currentAccountId() {
      if (accountIdOverride != null) {
        return accountIdOverride;
      }
      for (User u : [
        SELECT Contact.AccountId
        FROM User
        WHERE Id = :UserInfo.getUserId() AND ContactId != NULL
      ]) {
        return u.Contact.AccountId;
      }
      return null;
    }
    String agentId() {
      return [
        SELECT Id
        FROM BotDefinition
        WHERE DeveloperName = :AGENT
        LIMIT 1
      ]
      .Id;
    }
  }

  @TestVisible
  static Id accountIdOverride; // lets tests run without a community user licence

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
