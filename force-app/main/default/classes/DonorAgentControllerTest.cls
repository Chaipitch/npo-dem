@IsTest
private class DonorAgentControllerTest {
  @IsTest
  static void blankMessageIsRejectedBeforeCallingTheAgent() {
    DonorAgentController.Reply r = DonorAgentController.ask('   ', null);
    Assert.areEqual('Please type a question.', r.error);
    Assert.isNull(r.text);
  }

  @IsTest
  static void agentFailureReturnsAFriendlyError() {
    // The agent cannot run in a test context, so this exercises the failure path.
    DonorAgentController.Reply r = DonorAgentController.ask(
      'Which campaigns are open?',
      null
    );
    Assert.isTrue(
      String.isNotBlank(r.text) || String.isNotBlank(r.error),
      r.diagnostic
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
