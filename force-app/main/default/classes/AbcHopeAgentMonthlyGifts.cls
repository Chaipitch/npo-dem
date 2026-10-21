/**
 * Agent action: list and manage the verified donor's monthly gifts (gift commitments).
 * Mutations go through NPC's standard invocable actions after confirming the commitment
 * belongs to the verified donor. The agent must get explicit confirmation before calling
 * pause / resume / change_amount / cancel.
 */
public without sharing class AbcHopeAgentMonthlyGifts {
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
      description='Current messaging session (MessagingSession Id).'
      required=true
    )
    public String messagingSessionId;
    @InvocableVariable(
      label='Operation'
      description='One of: list, pause, resume, change_amount, cancel.'
      required=true
    )
    public String operation;
    @InvocableVariable(
      label='Gift number'
      description='Number of the monthly gift from the list (1, 2, ...). Not needed when the donor has only one.'
    )
    public Decimal giftNumber;
    @InvocableVariable(
      label='Pause months'
      description='For pause: how many months to pause, 1 to 12.'
    )
    public Decimal pauseMonths;
    @InvocableVariable(
      label='New monthly amount'
      description='For change_amount: the new monthly amount in THB, 100 to 1,000,000.'
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
      label='Monthly gifts'
      description='Numbered list of the donor\'s monthly gifts after the operation.'
    )
    public String monthlyGifts;
  }

  class Gift {
    GiftCommitment commitment;
    GiftCommitmentSchedule openSchedule; // open-ended CreateTransactions schedule
    GiftCommitmentSchedule pauseSchedule; // current or upcoming pause
    String designation;
  }

  @InvocableMethod(
    label='ABC Hope: Manage My Monthly Gifts'
    description='For a signed-in donor: list monthly gifts, or pause, resume, change the amount of, or cancel one of them.'
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
    Id accountId = AbcHopeAgentSupport.verifiedAccountId(
      req?.messagingSessionId
    );
    if (accountId == null) {
      r.message = 'The user is not signed in. Monthly gifts can only be managed after signing in on the ABC Hope site.';
      return r;
    }
    String op = req.operation == null ? '' : req.operation.trim().toLowerCase();
    if (!OPERATIONS.contains(op)) {
      r.message = 'Unknown operation. Use list, pause, resume, change_amount or cancel.';
      return r;
    }
    List<Gift> gifts = loadGifts(accountId);
    if (op == 'list') {
      r.success = true;
      r.monthlyGifts = describe(gifts);
      r.message = gifts.isEmpty()
        ? 'The donor has no active monthly gifts.'
        : 'Listed ' + gifts.size() + ' monthly gift(s).';
      return r;
    }
    if (gifts.isEmpty()) {
      r.message = 'The donor has no active monthly gifts to change.';
      return r;
    }
    Gift target;
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
      r.message = 'Ask the donor which monthly gift they mean.';
      r.monthlyGifts = describe(gifts);
      return r;
    }

    try {
      if (op == 'pause') {
        pause(
          target,
          req.pauseMonths == null ? null : req.pauseMonths.intValue(),
          r
        );
      } else if (op == 'resume') {
        resume(target, r);
      } else if (op == 'change_amount') {
        changeAmount(target, req.newAmount, r);
      } else {
        cancel(target, r);
      }
    } catch (Exception e) {
      r.success = false;
      r.message = 'The change could not be made right now. Offer to connect the donor with the ABC Hope team.';
      System.debug(
        LoggingLevel.ERROR,
        'Monthly gift ' + op + ' failed: ' + e.getMessage()
      );
    }
    r.monthlyGifts = describe(loadGifts(accountId));
    return r;
  }

  static void pause(Gift g, Integer months, Result r) {
    if (g.pauseSchedule != null) {
      r.message =
        'This monthly gift is already paused until ' +
        g.pauseSchedule.EndDate.format() +
        '.';
      return;
    }
    if (months == null || months < 1 || months > 12) {
      r.message = 'Ask how many months to pause (1 to 12).';
      return;
    }
    if (g.openSchedule == null) {
      r.message = 'This monthly gift has no active schedule to pause.';
      return;
    }
    Date startDate = later(Date.today().addDays(1), g.openSchedule.StartDate);
    Date endDate = startDate.addMonths(months).addDays(-1);
    Invocable.Action a = Invocable.Action.createStandardAction(
      'pauseGiftCommitmentSchedule'
    );
    a.setInvocationParameter(
      'giftCommitmentScheduleId',
      String.valueOf(g.openSchedule.Id)
    );
    a.setInvocationParameter('startDate', startDate);
    a.setInvocationParameter('endDate', endDate);
    apply(
      a,
      r,
      'Paused from ' +
        startDate.format() +
        ' to ' +
        endDate.format() +
        '. Gifts restart automatically after that.'
    );
  }

  static void resume(Gift g, Result r) {
    if (g.pauseSchedule == null) {
      r.message = 'This monthly gift is not paused.';
      return;
    }
    Invocable.Action a = Invocable.Action.createStandardAction(
      'resumeGiftCommitmentSchedule'
    );
    a.setInvocationParameter(
      'giftCommitmentScheduleId',
      String.valueOf(g.pauseSchedule.Id)
    );
    apply(a, r, 'The monthly gift has been resumed.');
  }

  static void changeAmount(Gift g, Decimal amount, Result r) {
    if (
      amount == null ||
      amount < DonationIntakeService.MIN_AMOUNT ||
      amount > DonationIntakeService.MAX_AMOUNT
    ) {
      r.message = 'Ask for a new monthly amount between THB 100 and THB 1,000,000.';
      return;
    }
    if (g.openSchedule == null) {
      r.message = 'This monthly gift has no active schedule to change.';
      return;
    }
    Date effective = later(Date.today().addDays(1), g.openSchedule.StartDate);
    Invocable.Action a = Invocable.Action.createStandardAction(
      'manageRcrGiftCmtSchd'
    );
    a.setInvocationParameter(
      'giftCommitmentSchedule',
      new GiftCommitmentSchedule(
        Id = g.openSchedule.Id,
        TransactionAmount = amount.setScale(2)
      )
    );
    a.setInvocationParameter('effectiveFromDate', effective);
    apply(
      a,
      r,
      'The monthly amount is now ' +
        AbcHopeAgentSupport.money(amount) +
        ', starting ' +
        effective.format() +
        '.'
    );
  }

  static void cancel(Gift g, Result r) {
    Invocable.Action a = Invocable.Action.createStandardAction(
      'closeGiftCommitment'
    );
    a.setInvocationParameter(
      'giftCommitmentId',
      String.valueOf(g.commitment.Id)
    );
    apply(
      a,
      r,
      'The monthly gift has been cancelled. No further gifts will be scheduled.'
    );
  }

  static void apply(Invocable.Action a, Result r, String successMessage) {
    List<Invocable.Action.Result> out = a.invoke();
    r.success = !out.isEmpty() && out[0].isSuccess();
    r.message = r.success
      ? successMessage
      : 'The change could not be made right now. Offer to connect the donor with the ABC Hope team.';
    if (!r.success && !out.isEmpty()) {
      System.debug(
        LoggingLevel.ERROR,
        'Standard action failed: ' + out[0].getErrors()
      );
    }
  }

  static List<Gift> loadGifts(Id accountId) {
    Map<Id, GiftCommitment> commitments = new Map<Id, GiftCommitment>(
      [
        SELECT Id, Name, Status, Campaign.Name, CreatedDate
        FROM GiftCommitment
        WHERE DonorId = :accountId AND Status IN ('Active', 'Paused')
        ORDER BY CreatedDate
        LIMIT 20
      ]
    );
    Map<Id, Gift> byId = new Map<Id, Gift>();
    for (GiftCommitment gc : commitments.values()) {
      Gift g = new Gift();
      g.commitment = gc;
      byId.put(gc.Id, g);
    }
    Date today = Date.today();
    for (GiftCommitmentSchedule s : [
      SELECT
        Id,
        GiftCommitmentId,
        Type,
        StartDate,
        EndDate,
        TransactionAmount,
        TransactionPeriod
      FROM GiftCommitmentSchedule
      WHERE
        GiftCommitmentId IN :byId.keySet()
        AND (EndDate = NULL
        OR EndDate >= :today)
      ORDER BY StartDate
    ]) {
      Gift g = byId.get(s.GiftCommitmentId);
      if (s.Type == 'PauseTransactions' && g.pauseSchedule == null) {
        g.pauseSchedule = s;
      } else if (s.Type == 'CreateTransactions' && s.EndDate == null) {
        g.openSchedule = s;
      }
    }
    for (GiftDefaultDesignation gdd : [
      SELECT ParentRecordId, GiftDesignation.Name
      FROM GiftDefaultDesignation
      WHERE ParentRecordId IN :byId.keySet()
    ]) {
      byId.get(gdd.ParentRecordId).designation = gdd.GiftDesignation.Name;
    }
    List<Gift> gifts = new List<Gift>();
    for (GiftCommitment gc : commitments.values()) {
      gifts.add(byId.get(gc.Id));
    }
    return gifts;
  }

  static String describe(List<Gift> gifts) {
    if (gifts.isEmpty()) {
      return 'No active monthly gifts.';
    }
    List<String> lines = new List<String>();
    for (Integer i = 0; i < gifts.size(); i++) {
      Gift g = gifts[i];
      String line =
        (i + 1) +
        '. ' +
        (g.openSchedule == null
          ? 'Monthly gift'
          : AbcHopeAgentSupport.money(g.openSchedule.TransactionAmount) +
            ' per month');
      if (String.isNotBlank(g.designation)) {
        line += ' to ' + g.designation;
      }
      if (g.commitment.Campaign != null) {
        line += ' (' + g.commitment.Campaign.Name + ')';
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

  static Date later(Date a, Date b) {
    return b != null && b > a ? b : a;
  }
}
