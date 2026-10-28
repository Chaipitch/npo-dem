/**
 * The dashboard Ask panel reply (D-51): the agent session to continue and its text, or a friendly error.
 */
public with sharing class TSAbcHopeDonorAgentDto {
  public class Reply {
    @AuraEnabled
    public String sessionId;
    @AuraEnabled
    public String text;
    @AuraEnabled
    public String error;
  }
}
