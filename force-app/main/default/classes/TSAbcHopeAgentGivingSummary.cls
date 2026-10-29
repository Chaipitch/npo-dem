/** Agent action: the verified donor's own giving summary (totals, causes, recent gifts, recurring gifts). */
public without sharing class TSAbcHopeAgentGivingSummary {
  public class Request {
    @InvocableVariable(
      label='Messaging session ID'
      description='Current messaging session (MessagingSession Id). Empty for dashboard (Agent API) conversations.'
    )
    public String messagingSessionId;
    @InvocableVariable(
      label='Verified account ID'
      description='Signed-in donor account Id supplied by the ABC Hope dashboard (Agent API). Not user input.'
    )
    public String verifiedAccountId;
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
    description='For a signed-in donor, returns their total giving, causes supported, recent gifts and active recurring gifts. Returns isVerified=false for guests.'
  )
  public static List<Result> getSummary(List<Request> requests) {
    List<Result> results = new List<Result>();
    for (Request req : requests) {
      Result r = new Result();
      Id accountId = TSAbcHopeAgentSupport.verifiedAccountId(
        req?.messagingSessionId,
        req?.verifiedAccountId
      );
      if (accountId == null) {
        r.summary = 'The user is not signed in. Ask them to sign in on the ABC Hope site to see their giving.';
        results.add(r);
        continue;
      }
      TSAbcHopeDonorPortalDto.Dashboard d = TSAbcHopeDonorPortalService.buildDashboard(
        TSAbcHopeDonorPortalService.loadAccount(accountId)
      );
      r.isVerified = true;
      r.donorFirstName = d.firstName;
      List<String> lines = new List<String>{
        'Donor: ' + d.donorName,
        'Supporter since: ' + d.supporterSince,
        'Total contributions: ' +
        TSAbcHopeAgentSupport.money(d.totalContributions) +
        ' across ' +
        d.giftCount +
        ' gift(s)',
        'Causes supported (' +
        d.causesSupported +
        '): ' +
        (d.causes.isEmpty() ? 'none yet' : String.join(d.causes, ', '))
      };
      if (!d.gifts.isEmpty()) {
        lines.add('Recent gifts:');
        for (Integer i = 0; i < Math.min(5, d.gifts.size()); i++) {
          TSAbcHopeDonorPortalDto.Gift g = d.gifts[i];
          lines.add(
            '- ' +
              g.giftDate.format() +
              ': ' +
              TSAbcHopeAgentSupport.money(g.amount) +
              (String.isBlank(g.designations) ? '' : ' to ' + g.designations) +
              (String.isBlank(g.programs)
                ? ''
                : ' [program: ' + g.programs + ']') +
              (String.isBlank(g.campaignName)
                ? ''
                : ' (' + g.campaignName + ')') +
              ', status ' +
              g.status
          );
        }
      }
      lines.add(programsLine(accountId, d));
      lines.addAll(campaignLines(accountId));
      lines.add(
        'Active recurring gifts: ' +
          d.activeMonthlyGifts +
          (d.activeRecurringTypes.isEmpty()
            ? ''
            : ' (' + String.join(d.activeRecurringTypes, ', ') + ')')
      );
      List<String> journey = new List<String>();
      for (TSAbcHopeDonorPortalDto.Milestone m : d.journey) {
        journey.add(m.year + ' ' + m.label);
      }
      lines.add('Impact journey: ' + String.join(journey, ' → '));
      r.summary = String.join(lines, '\n');
      results.add(r);
    }
    return results;
  }

  /**
   * Which open campaigns the donor has given to and which not yet (D-59): campaigns of their counted gifts and of
   * their active or paused recurring gifts, against the campaigns open for donations (the dashboard cards, D-18).
   * Each campaign not yet given to comes with its donate link.
   */
  @TestVisible
  static List<String> campaignLines(Id accountId) {
    Set<Id> given = new Set<Id>();
    for (GiftTransaction gt : [
      SELECT CampaignId
      FROM GiftTransaction
      WHERE
        DonorId = :accountId
        AND CampaignId != NULL
        AND Status NOT IN (
          'Canceled',
          'Failed',
          'Fully Refunded',
          'Written-Off'
        )
    ]) {
      given.add(gt.CampaignId);
    }
    for (GiftCommitment gc : [
      SELECT CampaignId
      FROM GiftCommitment
      WHERE
        DonorId = :accountId
        AND CampaignId != NULL
        AND Status IN ('Active', 'Paused')
    ]) {
      given.add(gc.CampaignId);
    }
    List<String> givenNames = new List<String>();
    List<String> notYet = new List<String>();
    for (
      TSAbcHopeCampaignDto.CampaignCard card : TSAbcHopeCampaignService.getCampaigns()
    ) {
      if (given.contains(card.id)) {
        givenNames.add(card.name);
      } else {
        notYet.add(
          card.name +
            ' (Donate: ' +
            TSAbcHopeAgentSupport.siteUrl(
              '/donate?campaign=' +
              EncodingUtil.urlEncode(card.name, 'UTF-8').replace('+', '%20')
            ) +
            ')'
        );
      }
    }
    return new List<String>{
      'Open campaigns the donor has given to: ' +
      (givenNames.isEmpty() ? 'none yet' : String.join(givenNames, ', ')),
      'Open campaigns the donor has not given to yet: ' +
      (notYet.isEmpty()
        ? 'none, the donor has given to every open campaign'
        : String.join(notYet, '; '))
    };
  }

  /**
   * Programs (what causes fund, D-21) across the donor's counted gifts and active recurring gifts.
   * Causes are what the donor chose; programs are separate, so the agent must not list causes as programs.
   */
  @TestVisible
  static String programsLine(
    Id accountId,
    TSAbcHopeDonorPortalDto.Dashboard d
  ) {
    Set<String> programs = new Set<String>();
    // Across all counted gifts, not just the recent ones the dashboard sends (D-49).
    programs.addAll(d.programs);
    Boolean causeWithoutProgram = d.causeWithoutProgram;
    for (
      TSAbcHopeMonthlyGiftDto.Gift mg : TSAbcHopeMonthlyGiftService.load(
        accountId
      )
    ) {
      if (String.isNotBlank(mg.program)) {
        programs.add(mg.program);
      } else if (String.isNotBlank(mg.designation)) {
        causeWithoutProgram = true;
      }
    }
    List<String> sorted = new List<String>(programs);
    sorted.sort();
    return 'Programs funded (what the causes pay for, not the causes themselves): ' +
      (sorted.isEmpty() ? 'none recorded' : String.join(sorted, ', ')) +
      (causeWithoutProgram
        ? '. Some of the donor\'s causes are not linked to a program.'
        : '');
  }
}
