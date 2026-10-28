/**
 * Agent action: list and manage the verified donor's recurring gifts (gift commitments: weekly, monthly or yearly).
 * The gifts and the pause / resume / change_amount / cancel logic are TSAbcHopeMonthlyGiftService's, the same as
 * My Giving on the site (D-51); this class finds the verified donor, picks the gift by its number and words the
 * results for the agent.
 */
public without sharing class TSAbcHopeAgentMonthlyGifts {
  public static final Set<String> OPERATIONS = new Set<String>{
    'list',
    'pause',
    'resume',
    'change_amount',
    'cancel'
  };

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
    @InvocableVariable(
      label='Operation'
      description='One of: list, pause, resume, change_amount, cancel.'
      required=true
    )
    public String operation;
    @InvocableVariable(
      label='Gift number'
      description='Number of the recurring gift from the list (1, 2, ...). Not needed when the donor has only one.'
    )
    public Decimal giftNumber;
    @InvocableVariable(
      label='Pause months'
      description='For pause: how many months to pause, 1 to 12.'
    )
    public Decimal pauseMonths;
    @InvocableVariable(
      label='New amount'
      description='For change_amount: the new amount per gift in USD, 100 to 1,000,000. The schedule (weekly, monthly or yearly) stays the same.'
    )
    public Decimal newAmount;
  }

  public class Result {
    @InvocableVariable(label='Success')
    public Boolean success = false;
    @InvocableVariable(
      label='Message'
      description='What happened, in plain language, to relay to the donor.'
    )
    public String message;
    @InvocableVariable(
      label='Recurring gifts'
      description='Numbered list of the donor\'s recurring gifts after the operation, each with its type (Weekly, Monthly or Yearly).'
    )
    public String monthlyGifts;
  }

  static final String FAILED = 'The change could not be made right now. Offer to connect the donor with the ABC Hope team.';

  @InvocableMethod(
    label='ABC Hope: Manage My Recurring Gifts'
    description='For a signed-in donor: list recurring gifts (weekly, monthly or yearly), or pause, resume, change the amount of, or cancel one of them.'
  )
  public static List<Result> manage(List<Request> requests) {
    List<Result> results = new List<Result>();
    for (Request req : requests) {
      results.add(handle(req));
    }
    return results;
  }

  static Result handle(Request req) {
    Result r = new Result();
    Id accountId = TSAbcHopeAgentSupport.verifiedAccountId(
      req?.messagingSessionId,
      req?.verifiedAccountId
    );
    if (accountId == null) {
      r.message = 'The user is not signed in. Recurring gifts can only be managed after signing in on the ABC Hope site.';
      return r;
    }
    String op = req.operation == null ? '' : req.operation.trim().toLowerCase();
    if (!OPERATIONS.contains(op)) {
      r.message = 'Unknown operation. Use list, pause, resume, change_amount or cancel.';
      return r;
    }
    List<TSAbcHopeMonthlyGiftDto.Gift> gifts = TSAbcHopeMonthlyGiftService.load(
      accountId
    );
    if (op == 'list') {
      r.success = true;
      r.monthlyGifts = describe(gifts);
      r.message = gifts.isEmpty()
        ? 'The donor has no active recurring gifts.'
        : 'Listed ' + gifts.size() + ' recurring gift(s).';
      return r;
    }
    if (gifts.isEmpty()) {
      r.message = 'The donor has no active recurring gifts to change.';
      return r;
    }
    TSAbcHopeMonthlyGiftDto.Gift target;
    Integer giftNumber = req.giftNumber == null
      ? null
      : req.giftNumber.intValue();
    if (gifts.size() == 1 && giftNumber == null) {
      target = gifts[0];
    } else if (
      giftNumber != null &&
      giftNumber >= 1 &&
      giftNumber <= gifts.size()
    ) {
      target = gifts[giftNumber - 1];
    } else {
      r.message = 'Ask the donor which recurring gift they mean.';
      r.monthlyGifts = describe(gifts);
      return r;
    }

    try {
      apply(change(op, target, req), r);
    } catch (Exception e) {
      r.success = false;
      r.message = FAILED;
      System.debug(
        LoggingLevel.ERROR,
        'Recurring gift ' + op + ' failed: ' + e.getMessage()
      );
    }
    r.monthlyGifts = describe(TSAbcHopeMonthlyGiftService.load(accountId));
    return r;
  }

  /** Runs the change through the shared service; inputs the agent should ask for again are worded for it. */
  static TSAbcHopeMonthlyGiftDto.Outcome change(
    String op,
    TSAbcHopeMonthlyGiftDto.Gift target,
    Request req
  ) {
    if (op == 'pause') {
      Integer months = req.pauseMonths == null
        ? null
        : req.pauseMonths.intValue();
      if (
        target.pauseSchedule == null &&
        (months == null ||
        months < 1 ||
        months > TSAbcHopeMonthlyGiftService.MAX_PAUSE_MONTHS)
      ) {
        return new TSAbcHopeMonthlyGiftDto.Outcome(
          false,
          'Ask how many months to pause (1 to 12).'
        );
      }
      return TSAbcHopeMonthlyGiftService.pause(target, months);
    }
    if (op == 'resume') {
      return TSAbcHopeMonthlyGiftService.resume(target);
    }
    if (op == 'change_amount') {
      Decimal amount = req.newAmount;
      if (
        amount == null ||
        amount < TSAbcHopeDonationIntakeService.MIN_AMOUNT ||
        amount > TSAbcHopeDonationIntakeService.MAX_AMOUNT
      ) {
        return new TSAbcHopeMonthlyGiftDto.Outcome(
          false,
          'Ask for a new amount between USD 100 and USD 1,000,000.'
        );
      }
      return TSAbcHopeMonthlyGiftService.changeAmount(target, amount);
    }
    return TSAbcHopeMonthlyGiftService.cancel(target);
  }

  static void apply(TSAbcHopeMonthlyGiftDto.Outcome outcome, Result r) {
    r.success = outcome.success;
    r.message = outcome.message == TSAbcHopeMonthlyGiftService.FAILED
      ? FAILED
      : outcome.message;
  }

  static String describe(List<TSAbcHopeMonthlyGiftDto.Gift> gifts) {
    if (gifts.isEmpty()) {
      return 'No active recurring gifts.';
    }
    List<String> lines = new List<String>();
    for (Integer i = 0; i < gifts.size(); i++) {
      TSAbcHopeMonthlyGiftDto.Gift g = gifts[i];
      String line =
        (i + 1) +
        '. ' +
        (g.openSchedule == null
          ? 'Recurring gift'
          : 'Recurring (' +
            TSAbcHopeMonthlyGiftService.typeLabel(g.period) +
            '): ' +
            TSAbcHopeAgentSupport.money(g.amount) +
            ' per ' +
            TSAbcHopeMonthlyGiftService.unit(g.period));
      if (String.isNotBlank(g.designation)) {
        line += ' to ' + g.designation;
      }
      if (String.isNotBlank(g.campaignName)) {
        line += ' (' + g.campaignName + ')';
      }
      if (g.pauseSchedule != null) {
        line +=
          ' — paused ' +
          g.pauseSchedule.StartDate.format() +
          ' to ' +
          (g.pauseSchedule.EndDate == null
            ? 'further notice'
            : g.pauseSchedule.EndDate.format());
      }
      lines.add(line);
    }
    return String.join(lines, '\n');
  }
}
