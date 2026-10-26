@IsTest
private class DonorAgentControllerTest {
  /** Fake Agent API: records requests, answers start-session and send-message calls. */
  class AgentApiMock implements HttpCalloutMock {
    Integer status = 200;
    /** Message replies that come back as the prompt guard's refusal before normal answers. */
    Integer refusals = 0;
    List<HttpRequest> requests = new List<HttpRequest>();
    public HttpResponse respond(HttpRequest req) {
      requests.add(req);
      HttpResponse res = new HttpResponse();
      res.setStatusCode(status);
      if (status != 200) {
        res.setBody('{"message":"boom"}');
      } else if (req.getEndpoint().endsWith('/sessions')) {
        res.setBody(
          '{"sessionId":"sess-1","messages":[{"type":"Inform","message":"Hi!"}]}'
        );
      } else if (refusals > 0) {
        refusals--;
        res.setBody(
          '{"messages":[{"type":"Inform","message":"Sorry, I can\'t assist with that. I can help with campaigns."}]}'
        );
      } else {
        res.setBody(
          '{"messages":[{"type":"Inform","message":"You have given USD 2,250."}]}'
        );
      }
      return res;
    }
  }

  static Id donorAccount() {
    Account a = new Account(Name = 'Agent Panel Donor Org');
    insert a;
    return a.Id;
  }

  @IsTest
  static void usesVerifiedAgentReflectsTheSwitch() {
    DonorAgentController.USE_AGENT_API = false;
    Assert.isFalse(DonorAgentController.usesVerifiedAgent());
    DonorAgentController.USE_AGENT_API = true;
    Assert.isTrue(DonorAgentController.usesVerifiedAgent());
  }

  @IsTest
  static void blankMessageIsRejectedBeforeCallingTheAgent() {
    DonorAgentController.Reply r = DonorAgentController.ask('   ', null);
    Assert.areEqual('Please type a question.', r.error);
    Assert.isNull(r.text);
  }

  @IsTest
  static void invocablePathFailsGracefullyInTests() {
    DonorAgentController.USE_AGENT_API = false;
    // The agent cannot run in a test context, so this exercises the failure path.
    DonorAgentController.Reply r = DonorAgentController.ask(
      'Which campaigns are open?',
      null
    );
    Assert.isTrue(String.isNotBlank(r.text) || String.isNotBlank(r.error));
  }

  @IsTest
  static void agentApiStartsAVerifiedSessionForTheDonor() {
    Id accountId = donorAccount();
    DonorAgentController.USE_AGENT_API = true;
    DonorAgentController.accountIdOverride = accountId;
    AgentApiMock mock = new AgentApiMock();
    Test.setMock(HttpCalloutMock.class, mock);

    Test.startTest();
    DonorAgentController.Reply r = DonorAgentController.ask(
      'How much have I given?',
      null
    );
    Test.stopTest();

    Assert.isNull(r.error);
    Assert.areEqual('sess-1', r.sessionId);
    Assert.areEqual('You have given USD 2,250.', r.text);
    Assert.areEqual(2, mock.requests.size(), 'start session, then message');
    HttpRequest start = mock.requests[0];
    Assert.isTrue(
      start.getEndpoint()
        .startsWith('callout:ABC_Hope_Agent_API/einstein/ai-agent/v1/agents/')
    );
    Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(
      start.getBody()
    );
    Map<String, Object> variable = (Map<String, Object>) ((List<Object>) body.get(
      'variables'
    ))[0];
    Assert.areEqual('verified_account_id', variable.get('name'));
    Assert.areEqual(String.valueOf(accountId), variable.get('value'));
    Assert.isTrue(
      mock.requests[1].getEndpoint().endsWith('/sessions/sess-1/messages')
    );
    Assert.isTrue(
      mock.requests[1].getBody().contains('How much have I given?')
    );
  }

  @IsTest
  static void agentApiReusesAnExistingSession() {
    DonorAgentController.USE_AGENT_API = true;
    DonorAgentController.accountIdOverride = donorAccount();
    AgentApiMock mock = new AgentApiMock();
    Test.setMock(HttpCalloutMock.class, mock);

    Test.startTest();
    DonorAgentController.Reply r = DonorAgentController.ask(
      'And my monthly gifts?',
      'sess-1'
    );
    Test.stopTest();

    Assert.areEqual(1, mock.requests.size(), 'no new session');
    Assert.areEqual('sess-1', r.sessionId);
  }

  @IsTest
  static void guardRefusalIsRetriedOnceInAFreshSession() {
    DonorAgentController.USE_AGENT_API = true;
    DonorAgentController.accountIdOverride = donorAccount();
    AgentApiMock mock = new AgentApiMock();
    mock.refusals = 1;
    Test.setMock(HttpCalloutMock.class, mock);

    Test.startTest();
    DonorAgentController.Reply r = DonorAgentController.ask(
      'Pause gift 2 for 2 months',
      'sess-old'
    );
    Test.stopTest();

    Assert.areEqual(3, mock.requests.size(), 'message, new session, message');
    Assert.isTrue(mock.requests[1].getEndpoint().endsWith('/sessions'));
    Assert.areEqual('sess-1', r.sessionId);
    Assert.areEqual('You have given USD 2,250.', r.text);
  }

  @IsTest
  static void guardRefusalIsNotRetriedTwice() {
    DonorAgentController.USE_AGENT_API = true;
    DonorAgentController.accountIdOverride = donorAccount();
    AgentApiMock mock = new AgentApiMock();
    mock.refusals = 2;
    Test.setMock(HttpCalloutMock.class, mock);

    Test.startTest();
    DonorAgentController.Reply r = DonorAgentController.ask(
      'Hello',
      'sess-old'
    );
    Test.stopTest();

    Assert.areEqual(3, mock.requests.size());
    Assert.isTrue(r.text.startsWith('Sorry'));
  }

  @IsTest
  static void isGuardRefusalMatchesOnlyTheRefusal() {
    Assert.isTrue(
      DonorAgentController.isGuardRefusal(
        'Sorry, I can\u2019t assist with that.'
      )
    );
    Assert.isFalse(
      DonorAgentController.isGuardRefusal('Sorry, that gift is ended.')
    );
    Assert.isFalse(DonorAgentController.isGuardRefusal(null));
  }

  @IsTest
  static void agentApiErrorsAreFriendlyAndHideDetails() {
    DonorAgentController.USE_AGENT_API = true;
    DonorAgentController.accountIdOverride = donorAccount();
    AgentApiMock mock = new AgentApiMock();
    mock.status = 500;
    Test.setMock(HttpCalloutMock.class, mock);

    Test.startTest();
    DonorAgentController.Reply r = DonorAgentController.ask('Hello', null);
    Test.stopTest();

    Assert.isNull(r.text);
    Assert.areEqual(
      'The assistant could not answer right now. Please try again.',
      r.error
    );
  }

  @IsTest
  static void replyTextReadsTheAgentJson() {
    Assert.areEqual(
      'Hello',
      DonorAgentController.replyText('{"type":"Text","value":"Hello"}')
    );
    Assert.areEqual('plain', DonorAgentController.replyText('plain'));
    Assert.areEqual('', DonorAgentController.replyText(null));
  }
}
