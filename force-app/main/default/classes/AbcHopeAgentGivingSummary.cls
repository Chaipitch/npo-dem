/** Agent action: the verified donor's own giving summary (totals, causes, recent gifts, monthly gifts). */
public without sharing class AbcHopeAgentGivingSummary {
  public class Request {
    @InvocableVariable(
      label='Messaging session ID'
      description='Current messaging session (MessagingSession Id).'
      required=true
    )
    public String messagingSessionId;
  }

  public class Result {
    @InvocableVariable(
      label='Is verified donor'
      description='True when the chat user is a signed-in, verified ABC Hope donor.'
    )
    public Boolean isVerified = false;
    @InvocableVariable(label='Donor first name')
    public String donorFirstName;
    @InvocableVariable(
      label='Giving summary'
      description='Plain-text summary of the donor\'s giving. Empty when not verified.'
    )
    public String summary;
  }

  @InvocableMethod(
    label='ABC Hope: Get My Giving Summary'
    description='For a signed-in donor, returns their total giving, causes supported, recent gifts and active monthly gifts. Returns isVerified=false for guests.'
  )
  public static List<Result> getSummary(List<Request> requests) {
    List<Result> results = new List<Result>();
    for (Request req : requests) {
      Result r = new Result();
      Id accountId = AbcHopeAgentSupport.verifiedAccountId(
        req?.messagingSessionId
      );
      if (accountId == null) {
        r.summary = 'The user is not signed in. Ask them to sign in on the ABC Hope site to see their giving.';
        results.add(r);
        continue;
      }
      DonorPortalController.Dashboard d = DonorPortalController.buildDashboard(
        DonorPortalController.loadAccount(accountId)
      );
      r.isVerified = true;
      r.donorFirstName = d.firstName;
      List<String> lines = new List<String>{
        'Donor: ' + d.donorName,
        'Supporter since: ' + d.supporterSince,
        'Total contributions: ' +
        AbcHopeAgentSupport.money(d.totalContributions) +
        ' across ' +
        d.gifts.size() +
        ' gift(s)',
        'Causes supported (' +
        d.causesSupported +
        '): ' +
        (d.causes.isEmpty() ? 'none yet' : String.join(d.causes, ', '))
      };
      if (!d.gifts.isEmpty()) {
        lines.add('Recent gifts:');
        for (Integer i = 0; i < Math.min(5, d.gifts.size()); i++) {
          DonorPortalController.Gift g = d.gifts[i];
          lines.add(
            '- ' +
              g.giftDate.format() +
              ': ' +
              AbcHopeAgentSupport.money(g.amount) +
              (String.isBlank(g.designations) ? '' : ' to ' + g.designations) +
              (String.isBlank(g.campaignName)
                ? ''
                : ' (' + g.campaignName + ')') +
              ', status ' +
              g.status
          );
        }
      }
      lines.add('Active monthly gifts: ' + d.activeMonthlyGifts);
      List<String> journey = new List<String>();
      for (DonorPortalController.Milestone m : d.journey) {
        journey.add(m.year + ' ' + m.label);
      }
      lines.add('Impact journey: ' + String.join(journey, ' → '));
      r.summary = String.join(lines, '\n');
      results.add(r);
    }
    return results;
  }
}
