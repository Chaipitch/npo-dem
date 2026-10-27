/**
 * Recurring gifts (gift commitments: weekly, monthly or yearly, D-24) for one donor on the ABC Hope site's My Giving page:
 * list, pause, resume, change amount, cancel (D-22). Mutations go through NPC's standard
 * invocable actions — the same ones the agent's TSAbcHopeAgentMonthlyGifts action uses.
 *
 * Runs without sharing: callers must pass the running portal user's own account Id,
 * never an Id typed by the user (D-12).
 * NPC keeps a paused commitment Active and adds a PauseTransactions schedule, so "paused" here
 * means a current or upcoming pause schedule, not the commitment status.
 */
public without sharing class TSAbcHopeMonthlyGiftService {
  public static final Integer MAX_PAUSE_MONTHS = 12;
  public static final String FAILED = 'We could not make this change right now. Please try again later or contact the ABC Hope team.';

  public class Gift {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal amount;
    /** Schedule period: Weekly, Monthly or Yearly (D-24); older schedules may say Custom. */
    @AuraEnabled
    public String period;
    @AuraEnabled
    public String designation;
    @AuraEnabled
    public String program;
    @AuraEnabled
    public String campaignName;
    @AuraEnabled
    public Boolean isPaused = false;
    @AuraEnabled
    public Date pausedFrom;
    @AuraEnabled
    public Date pausedUntil;
    @AuraEnabled
    public Date nextGiftDate;

    public GiftCommitment commitment;
    public GiftCommitmentSchedule openSchedule; // open-ended CreateTransactions schedule
    public GiftCommitmentSchedule pauseSchedule; // current or upcoming pause
  }

  public class Outcome {
    public Boolean success = false;
    public String message;
    Outcome(Boolean success, String message) {
      this.success = success;
      this.message = message;
    }
  }

  /** "Weekly" | "Monthly" | "Yearly" for a schedule period; anything else (e.g. Custom) reads as Monthly. */
  public static String typeLabel(String period) {
    return period == 'Weekly' || period == 'Yearly' ? period : 'Monthly';
  }

  /** "week" | "month" | "year", for "USD 300 per week". */
  public static String unit(String period) {
    String t = typeLabel(period);
    return t == 'Weekly' ? 'week' : t == 'Yearly' ? 'year' : 'month';
  }

  /** The donor's open recurring gifts, oldest first. */
  public static List<Gift> load(Id accountId) {
    Map<Id, Gift> byId = new Map<Id, Gift>();
    for (GiftCommitment gc : [
      SELECT Id, Name, Status, Campaign.Name, CreatedDate
      FROM GiftCommitment
      WHERE DonorId = :accountId AND Status IN ('Active', 'Paused')
      ORDER BY CreatedDate
      LIMIT 20
    ]) {
      Gift g = new Gift();
      g.commitment = gc;
      g.id = gc.Id;
      g.name = gc.Name;
      g.campaignName = gc.Campaign?.Name;
      byId.put(gc.Id, g);
    }
    if (byId.isEmpty()) {
      return new List<Gift>();
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
        g.isPaused = true;
        g.pausedFrom = s.StartDate;
        g.pausedUntil = s.EndDate;
      } else if (s.Type == 'CreateTransactions' && s.EndDate == null) {
        g.openSchedule = s;
        g.amount = s.TransactionAmount;
        g.period = s.TransactionPeriod;
      }
    }
    for (GiftDefaultDesignation gdd : [
      SELECT
        ParentRecordId,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name
      FROM GiftDefaultDesignation
      WHERE ParentRecordId IN :byId.keySet()
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
    ]) {
      Gift g = byId.get(gdd.ParentRecordId);
      if (g.designation == null) {
        g.designation = gdd.GiftDesignation.Name;
        g.program = gdd.GiftDesignation.NGOTV_Program__r?.Name;
      }
    }
    for (AggregateResult ar : [
      SELECT GiftCommitmentId gcId, MIN(TransactionDueDate) nextDue
      FROM GiftTransaction
      WHERE
        GiftCommitmentId IN :byId.keySet()
        AND Status = 'Unpaid'
        AND TransactionDueDate >= :today
      GROUP BY GiftCommitmentId
    ]) {
      byId.get((Id) ar.get('gcId')).nextGiftDate = (Date) ar.get('nextDue');
    }
    return byId.values();
  }

  /** The donor's gift with this Id, or null when it is not one of theirs. */
  public static Gift find(Id accountId, String giftId) {
    for (Gift g : load(accountId)) {
      if (g.id == giftId) {
        return g;
      }
    }
    return null;
  }

  public static Outcome pause(Gift g, Integer months) {
    if (g.pauseSchedule != null) {
      return new Outcome(
        false,
        'This recurring gift is already paused until ' +
          (g.pauseSchedule.EndDate == null
            ? 'further notice'
            : g.pauseSchedule.EndDate.format()) +
          '.'
      );
    }
    if (months == null || months < 1 || months > MAX_PAUSE_MONTHS) {
      return new Outcome(
        false,
        'Please choose how many months to pause (1 to 12).'
      );
    }
    if (g.openSchedule == null) {
      return new Outcome(
        false,
        'This recurring gift has no active schedule to pause.'
      );
    }
    // A pause starts today (the donor's date, which NPC also checks), so the gift shows Paused at once (D-43).
    GiftCommitmentSchedule target = scheduleToPause(g.commitment.Id, months);
    if (target == null) {
      return new Outcome(false, FAILED);
    }
    Date startDate = later(Date.today(), target.StartDate);
    Date endDate = startDate.addMonths(months).addDays(-1);
    if (target.EndDate != null && target.EndDate < endDate) {
      return new Outcome(false, tooLong(target.EndDate));
    }
    Invocable.Action a = Invocable.Action.createStandardAction(
      'pauseGiftCommitmentSchedule'
    );
    a.setInvocationParameter(
      'giftCommitmentScheduleId',
      String.valueOf(target.Id)
    );
    a.setInvocationParameter('startDate', startDate);
    a.setInvocationParameter('endDate', endDate);
    return apply(
      a,
      'Paused from ' +
        startDate.format() +
        ' to ' +
        endDate.format() +
        '. Gifts restart automatically after that.'
    );
  }

  /**
   * The schedule to pause for `months` from today, or from the gift's first date if it starts later (D-44). NPC pauses one schedule and refuses a pause that runs
   * past that schedule's end, but every pause and resume splits schedules: after a resume, today is covered by a
   * schedule that ends soon and the open-ended one starts later. So take the CreateTransactions schedule covering
   * the start and, if the pause runs past its end, join it with the following pieces that are the same gift (same
   * amount, period, day, campaign and payment method, no instalments yet): they are deleted and the first piece is
   * extended. Returns that schedule; its EndDate is still before the pause's end when the pieces differ (e.g. a new
   * amount starts), so the caller can say how long the gift can be paused. Null when no schedule covers the start.
   */
  public static GiftCommitmentSchedule scheduleToPause(
    Id commitmentId,
    Integer months
  ) {
    Date today = Date.today();
    List<GiftCommitmentSchedule> pieces = [
      SELECT
        Id,
        Type,
        StartDate,
        EndDate,
        TransactionAmount,
        TransactionPeriod,
        TransactionInterval,
        TransactionDay,
        CampaignId,
        PaymentMethod
      FROM GiftCommitmentSchedule
      WHERE
        GiftCommitmentId = :commitmentId
        AND (EndDate = NULL
        OR EndDate >= :today)
      ORDER BY StartDate
    ];
    GiftCommitmentSchedule first;
    Date endDate;
    List<GiftCommitmentSchedule> toJoin = new List<GiftCommitmentSchedule>();
    Date joinedEnd;
    for (GiftCommitmentSchedule s : pieces) {
      if (first == null) {
        if (s.Type == 'CreateTransactions') {
          first = s;
          joinedEnd = s.EndDate;
          endDate = later(today, s.StartDate).addMonths(months).addDays(-1);
        }
        continue;
      }
      if (
        joinedEnd == null ||
        joinedEnd >= endDate ||
        s.StartDate != joinedEnd.addDays(1) ||
        !sameGift(first, s)
      ) {
        break;
      }
      toJoin.add(s);
      joinedEnd = s.EndDate;
    }
    if (first == null || toJoin.isEmpty()) {
      return first;
    }
    Savepoint sp = Database.setSavepoint();
    try {
      if (
        [
          SELECT COUNT()
          FROM GiftTransaction
          WHERE GiftCommitmentScheduleId IN :toJoin
        ] > 0
      ) {
        return first;
      }
      delete toJoin;
      update new GiftCommitmentSchedule(Id = first.Id, EndDate = joinedEnd);
      first.EndDate = joinedEnd;
    } catch (Exception e) {
      Database.rollback(sp);
      System.debug(
        LoggingLevel.ERROR,
        'Joining schedules failed: ' + e.getMessage()
      );
    }
    return first;
  }

  static Boolean sameGift(GiftCommitmentSchedule a, GiftCommitmentSchedule b) {
    return b.Type == 'CreateTransactions' &&
      a.TransactionAmount == b.TransactionAmount &&
      a.TransactionPeriod == b.TransactionPeriod &&
      a.TransactionInterval == b.TransactionInterval &&
      a.TransactionDay == b.TransactionDay &&
      // NPC's resume leaves the piece it reopens without a campaign; the commitment's campaign still applies.
      (a.CampaignId == b.CampaignId ||
      a.CampaignId == null ||
      b.CampaignId == null) &&
      a.PaymentMethod == b.PaymentMethod;
  }

  /** The message when a change to the gift (e.g. a new amount) starts before the pause would end. */
  public static String tooLong(Date lastDay) {
    return 'This recurring gift changes after ' +
      lastDay.format() +
      ', so it can be paused until then at most. Please choose a shorter pause.';
  }

  public static Outcome resume(Gift g) {
    if (g.pauseSchedule == null) {
      return new Outcome(false, 'This recurring gift is not paused.');
    }
    Invocable.Action a = Invocable.Action.createStandardAction(
      'resumeGiftCommitmentSchedule'
    );
    a.setInvocationParameter(
      'giftCommitmentScheduleId',
      String.valueOf(g.pauseSchedule.Id)
    );
    return apply(a, 'The recurring gift has been resumed.');
  }

  public static Outcome changeAmount(Gift g, Decimal amount) {
    if (
      amount == null ||
      amount < TSAbcHopeDonationIntakeService.MIN_AMOUNT ||
      amount > TSAbcHopeDonationIntakeService.MAX_AMOUNT
    ) {
      return new Outcome(
        false,
        'Please enter an amount between USD 100 and USD 1,000,000.'
      );
    }
    if (g.openSchedule == null) {
      return new Outcome(
        false,
        'This recurring gift has no active schedule to change.'
      );
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
    return apply(
      a,
      'The amount is now ' +
        TSAbcHopeAgentSupport.money(amount) +
        ' per ' +
        unit(g.openSchedule.TransactionPeriod) +
        ', starting ' +
        effective.format() +
        '.'
    );
  }

  public static Outcome cancel(Gift g) {
    Invocable.Action a = Invocable.Action.createStandardAction(
      'closeGiftCommitment'
    );
    a.setInvocationParameter(
      'giftCommitmentId',
      String.valueOf(g.commitment.Id)
    );
    return apply(
      a,
      'The recurring gift has been cancelled. No further gifts will be scheduled.'
    );
  }

  static Outcome apply(Invocable.Action a, String successMessage) {
    try {
      List<Invocable.Action.Result> out = a.invoke();
      if (!out.isEmpty() && out[0].isSuccess()) {
        return new Outcome(true, successMessage);
      }
      System.debug(
        LoggingLevel.ERROR,
        'Standard action failed: ' + (out.isEmpty() ? null : out[0].getErrors())
      );
    } catch (Exception e) {
      System.debug(
        LoggingLevel.ERROR,
        'Standard action threw: ' + e.getMessage()
      );
    }
    return new Outcome(false, FAILED);
  }

  static Date later(Date a, Date b) {
    return b != null && b > a ? b : a;
  }
}
