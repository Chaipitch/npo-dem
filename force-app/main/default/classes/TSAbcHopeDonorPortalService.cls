/**
 * Signed-in donor portal logic (D-51): dashboard KPIs, giving history, impact journey, profile and recurring
 * gifts. Every query is scoped to the running user's own Account, so donors can only ever see and edit their own
 * data. Called by TSAbcHopeDonorPortalController; data shapes are in TSAbcHopeDonorPortalDto. Problems a donor
 * should read are thrown as PortalException; the controller turns them into AuraHandledException.
 */
public without sharing class TSAbcHopeDonorPortalService {
  public class PortalException extends Exception {
  }

  static final Set<String> EXCLUDED_STATUSES = new Set<String>{
    'Canceled',
    'Failed',
    'Fully Refunded',
    'Written-Off'
  };
  static final Pattern EMAIL_PATTERN = Pattern.compile(
    '^[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
  );

  public static final Integer GIVING_PAGE_SIZE = 5;
  /** Gifts sent with the dashboard: the most recent few, for the panel and the agent (D-49). */
  static final Integer RECENT_GIFTS = 5;

  public static TSAbcHopeDonorPortalDto.Dashboard getDashboard() {
    return buildDashboard(currentAccount());
  }

  /** Giving summary for one donor account. Callers must have already established that the account is the requester's own. */
  public static TSAbcHopeDonorPortalDto.Dashboard buildDashboard(Account acc) {
    TSAbcHopeDonorPortalDto.Dashboard d = new TSAbcHopeDonorPortalDto.Dashboard();
    d.donorName = acc.Name;
    d.firstName = String.isNotBlank(acc.FirstName) ? acc.FirstName : acc.Name;

    Map<Id, GiftTransaction> txns = new Map<Id, GiftTransaction>(
      countedGifts(acc.Id)
    );
    Map<Id, List<String>> designationsByTxn = new Map<Id, List<String>>();
    Map<Id, List<String>> programsByTxn = new Map<Id, List<String>>();
    // Year a cause was first supported, for the impact journey.
    Map<String, Integer> firstYearByCause = new Map<String, Integer>();
    JourneyBuilder journey = new JourneyBuilder();
    for (GiftTransactionDesignation gtd : [
      SELECT
        GiftTransactionId,
        Amount,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId IN :txns.keySet() AND GiftDesignationId != NULL
    ]) {
      String cause = gtd.GiftDesignation.Name;
      if (!designationsByTxn.containsKey(gtd.GiftTransactionId)) {
        designationsByTxn.put(gtd.GiftTransactionId, new List<String>());
      }
      designationsByTxn.get(gtd.GiftTransactionId).add(cause);
      TSAbcHopeCampaignService.addProgram(
        programsByTxn,
        gtd.GiftTransactionId,
        gtd.GiftDesignation.NGOTV_Program__r?.Name
      );
      GiftTransaction gt = txns.get(gtd.GiftTransactionId);
      Integer year = giftYear(gt);
      journey.add(
        year,
        cause,
        gtd.GiftDesignation.NGOTV_Program__r?.Name,
        gtd.Amount != null ? gtd.Amount : gt.OriginalAmount,
        gt.Id
      );
      if (
        !firstYearByCause.containsKey(cause) ||
        year < firstYearByCause.get(cause)
      ) {
        firstYearByCause.put(cause, year);
      }
    }

    Integer firstYear = supporterSinceYear(acc, txns.values());
    for (GiftTransaction gt : txns.values()) {
      d.totalContributions += gt.OriginalAmount == null ? 0 : gt.OriginalAmount;
      if (d.gifts.size() < RECENT_GIFTS) {
        d.gifts.add(toGift(gt, designationsByTxn, programsByTxn));
      }
      if (
        designationsByTxn.containsKey(gt.Id) &&
        !programsByTxn.containsKey(gt.Id)
      ) {
        d.causeWithoutProgram = true;
      }
    }
    d.giftCount = txns.size();
    Set<String> programNames = new Set<String>();
    for (List<String> names : programsByTxn.values()) {
      programNames.addAll(names);
    }
    d.programs = new List<String>(programNames);
    d.programs.sort();
    for (GiftDefaultDesignation gdd : [
      SELECT
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name,
        ParentRecordId
      FROM GiftDefaultDesignation
      WHERE
        ParentRecordId IN (
          SELECT Id
          FROM GiftCommitment
          WHERE DonorId = :acc.Id AND Status = 'Active'
        )
    ]) {
      if (!firstYearByCause.containsKey(gdd.GiftDesignation.Name)) {
        firstYearByCause.put(gdd.GiftDesignation.Name, Date.today().year());
        journey.addRecurring(
          Date.today().year(),
          gdd.GiftDesignation.Name,
          gdd.GiftDesignation.NGOTV_Program__r?.Name
        );
      }
    }
    // NPC keeps paused commitments Active, so count pauses from their schedules (D-22).
    Set<String> activeTypes = new Set<String>();
    for (
      TSAbcHopeMonthlyGiftDto.Gift mg : TSAbcHopeMonthlyGiftService.load(acc.Id)
    ) {
      if (mg.isPaused) {
        d.pausedMonthlyGifts++;
        if (
          mg.pausedUntil != null &&
          (d.pausedUntil == null ||
          mg.pausedUntil < d.pausedUntil)
        ) {
          d.pausedUntil = mg.pausedUntil;
        }
      } else {
        d.activeMonthlyGifts++;
        activeTypes.add(TSAbcHopeMonthlyGiftService.typeLabel(mg.period));
      }
    }
    for (String t : new List<String>{ 'Weekly', 'Monthly', 'Yearly' }) {
      if (activeTypes.contains(t)) {
        d.activeRecurringTypes.add(t);
      }
    }

    d.causes = new List<String>(firstYearByCause.keySet());
    d.causes.sort();
    d.causesSupported = d.causes.size();
    d.supporterSince = String.valueOf(firstYear);
    TSAbcHopeCampaignDto.Impact reach = TSAbcHopeCampaignService.getImpact();
    d.activePrograms = reach.programs;
    d.peopleReached = reach.peopleReached;
    d.communities = reach.communities;
    d.volunteersEngaged = reach.volunteers;

    TSAbcHopeDonorPortalDto.Milestone joined = new TSAbcHopeDonorPortalDto.Milestone();
    joined.year = String.valueOf(firstYear);
    joined.label = 'Joined as a supporter';
    joined.kind = 'joined';
    d.journey.add(joined);
    List<CauseYear> ordered = new List<CauseYear>();
    for (String cause : firstYearByCause.keySet()) {
      ordered.add(new CauseYear(cause, firstYearByCause.get(cause)));
    }
    ordered.sort();
    for (CauseYear cy : ordered) {
      TSAbcHopeDonorPortalDto.Milestone m = new TSAbcHopeDonorPortalDto.Milestone();
      m.year = String.valueOf(cy.year);
      m.label = 'Supported ' + cy.cause;
      m.kind = 'cause';
      d.journey.add(m);
    }
    d.journeyYears = journey.build(firstYear, firstYearByCause);
    return d;
  }

  public static TSAbcHopeDonorPortalDto.Profile getProfile() {
    Account acc = currentAccount();
    TSAbcHopeDonorPortalDto.Profile p = new TSAbcHopeDonorPortalDto.Profile();
    p.firstName = acc.FirstName;
    p.lastName = acc.LastName;
    p.email = acc.PersonEmail;
    p.phone = acc.PersonMobilePhone != null ? acc.PersonMobilePhone : acc.Phone;
    p.street = acc.PersonMailingStreet;
    p.city = acc.PersonMailingCity;
    p.country = acc.PersonMailingCountry;
    p.emailOptOut = acc.PersonHasOptedOutOfEmail;
    // Same rule as the dashboard's Supporter Since: earliest of account creation and first gift.
    p.donorSince = String.valueOf(
      supporterSinceYear(acc, countedGifts(acc.Id))
    );
    return p;
  }

  public static TSAbcHopeDonorPortalDto.Profile saveProfile(
    TSAbcHopeDonorPortalDto.Profile p
  ) {
    if (p == null) {
      throw new PortalException('Invalid profile details.');
    }
    Account acc = currentAccount();
    if (!acc.IsPersonAccount) {
      throw new PortalException(
        'Only individual donor profiles can be edited here.'
      );
    }
    String email = clean(p.email, 80);
    if (
      String.isBlank(clean(p.firstName, 40)) ||
      String.isBlank(clean(p.lastName, 80))
    ) {
      throw new PortalException('Please enter your first and last name.');
    }
    if (String.isBlank(email) || !EMAIL_PATTERN.matcher(email).matches()) {
      throw new PortalException('Please enter a valid email address.');
    }
    Account upd = new Account(
      Id = acc.Id,
      FirstName = clean(p.firstName, 40),
      LastName = clean(p.lastName, 80),
      PersonEmail = email.toLowerCase(),
      PersonMobilePhone = clean(p.phone, 40),
      PersonMailingStreet = clean(p.street, 255),
      PersonMailingCity = clean(p.city, 40),
      PersonMailingCountry = clean(p.country, 80),
      PersonHasOptedOutOfEmail = p.emailOptOut == true
    );
    try {
      update upd;
    } catch (DmlException e) {
      throw new PortalException(
        'We could not save your profile. ' + e.getDmlMessage(0)
      );
    }
    return getProfile();
  }

  // ---------------------------------------------------------------- monthly gifts

  static final Set<String> MONTHLY_OPERATIONS = new Set<String>{
    'pause',
    'resume',
    'change_amount',
    'cancel'
  };

  public static List<TSAbcHopeMonthlyGiftDto.Gift> getMonthlyGifts() {
    return TSAbcHopeMonthlyGiftService.load(currentAccount().Id);
  }

  /** Pause, resume, change or cancel one of the signed-in donor's own recurring gifts. */
  public static TSAbcHopeDonorPortalDto.MonthlyGiftsResult manageMonthlyGift(
    String giftId,
    String operation,
    Integer pauseMonths,
    Decimal newAmount
  ) {
    Account acc = currentAccount();
    String op = operation == null ? '' : operation.trim().toLowerCase();
    if (!MONTHLY_OPERATIONS.contains(op)) {
      throw new PortalException('Unknown action.');
    }
    TSAbcHopeMonthlyGiftDto.Gift gift = TSAbcHopeMonthlyGiftService.find(
      acc.Id,
      giftId
    );
    if (gift == null) {
      throw new PortalException('This recurring gift could not be found.');
    }
    TSAbcHopeMonthlyGiftDto.Outcome outcome;
    if (op == 'pause') {
      outcome = TSAbcHopeMonthlyGiftService.pause(gift, pauseMonths);
    } else if (op == 'resume') {
      outcome = TSAbcHopeMonthlyGiftService.resume(gift);
    } else if (op == 'change_amount') {
      outcome = TSAbcHopeMonthlyGiftService.changeAmount(gift, newAmount);
    } else {
      outcome = TSAbcHopeMonthlyGiftService.cancel(gift);
    }
    if (!outcome.success) {
      throw new PortalException(outcome.message);
    }
    TSAbcHopeDonorPortalDto.MonthlyGiftsResult res = new TSAbcHopeDonorPortalDto.MonthlyGiftsResult();
    res.message = outcome.message;
    res.gifts = TSAbcHopeMonthlyGiftService.load(acc.Id);
    return res;
  }

  // ---------------------------------------------------------------- helpers

  /** Collects gift designations into one card per year, each cause once per year with its total. */
  class JourneyBuilder {
    Map<Integer, Map<String, TSAbcHopeDonorPortalDto.JourneyItem>> byYear = new Map<Integer, Map<String, TSAbcHopeDonorPortalDto.JourneyItem>>();
    Map<Integer, Set<Id>> giftsByYear = new Map<Integer, Set<Id>>();
    Map<String, Set<Id>> giftsByYearCause = new Map<String, Set<Id>>();

    void add(
      Integer year,
      String cause,
      String program,
      Decimal amount,
      Id giftId
    ) {
      TSAbcHopeDonorPortalDto.JourneyItem item = item(year, cause, program);
      item.amount += amount == null ? 0 : amount;
      item.recurringOnly = false;
      String key = year + '|' + cause;
      if (!giftsByYearCause.containsKey(key)) {
        giftsByYearCause.put(key, new Set<Id>());
      }
      giftsByYearCause.get(key).add(giftId);
      item.giftCount = giftsByYearCause.get(key).size();
      if (!giftsByYear.containsKey(year)) {
        giftsByYear.put(year, new Set<Id>());
      }
      giftsByYear.get(year).add(giftId);
    }

    void addRecurring(Integer year, String cause, String program) {
      TSAbcHopeDonorPortalDto.JourneyItem item = item(year, cause, program);
      if (item.giftCount == 0) {
        item.recurringOnly = true;
      }
    }

    TSAbcHopeDonorPortalDto.JourneyItem item(
      Integer year,
      String cause,
      String program
    ) {
      if (!byYear.containsKey(year)) {
        byYear.put(
          year,
          new Map<String, TSAbcHopeDonorPortalDto.JourneyItem>()
        );
      }
      Map<String, TSAbcHopeDonorPortalDto.JourneyItem> items = byYear.get(year);
      if (!items.containsKey(cause)) {
        TSAbcHopeDonorPortalDto.JourneyItem item = new TSAbcHopeDonorPortalDto.JourneyItem();
        item.cause = cause;
        item.program = program;
        items.put(cause, item);
      }
      return items.get(cause);
    }

    /** Oldest year first (the joined year always has a card); causes by amount, largest first. */
    List<TSAbcHopeDonorPortalDto.JourneyYear> build(
      Integer joinedYear,
      Map<String, Integer> firstYearByCause
    ) {
      Set<Integer> years = new Set<Integer>(byYear.keySet());
      years.add(joinedYear);
      List<Integer> ordered = new List<Integer>(years);
      ordered.sort();
      List<TSAbcHopeDonorPortalDto.JourneyYear> result = new List<TSAbcHopeDonorPortalDto.JourneyYear>();
      for (Integer y : ordered) {
        TSAbcHopeDonorPortalDto.JourneyYear jy = new TSAbcHopeDonorPortalDto.JourneyYear();
        jy.year = String.valueOf(y);
        jy.joined = y == joinedYear;
        jy.giftCount = giftsByYear.containsKey(y)
          ? giftsByYear.get(y).size()
          : 0;
        List<ItemByAmount> sorted = new List<ItemByAmount>();
        if (byYear.containsKey(y)) {
          for (
            TSAbcHopeDonorPortalDto.JourneyItem item : byYear.get(y).values()
          ) {
            item.isNew = firstYearByCause.get(item.cause) == y;
            jy.total += item.amount;
            sorted.add(new ItemByAmount(item));
          }
        }
        sorted.sort();
        for (ItemByAmount s : sorted) {
          jy.items.add(s.item);
        }
        result.add(jy);
      }
      return result;
    }
  }

  class ItemByAmount implements Comparable {
    TSAbcHopeDonorPortalDto.JourneyItem item;
    ItemByAmount(TSAbcHopeDonorPortalDto.JourneyItem item) {
      this.item = item;
    }
    public Integer compareTo(Object other) {
      TSAbcHopeDonorPortalDto.JourneyItem o = ((ItemByAmount) other).item;
      if (item.amount != o.amount) {
        return item.amount > o.amount ? -1 : 1;
      }
      return item.cause.compareTo(o.cause);
    }
  }

  class CauseYear implements Comparable {
    String cause;
    Integer year;
    CauseYear(String cause, Integer year) {
      this.cause = cause;
      this.year = year;
    }
    public Integer compareTo(Object other) {
      CauseYear o = (CauseYear) other;
      if (year != o.year) {
        return year - o.year;
      }
      return cause.compareTo(o.cause);
    }
  }

  /**
   * One page of the signed-in donor's giving history (D-49): COUNT() plus that page's gifts and their designations,
   * so the page never loads the whole history. Pages past the end show the last page.
   */
  public static TSAbcHopeDonorPortalDto.GivingPage getGivingPage(Integer page) {
    Id accountId = currentAccount().Id;
    TSAbcHopeDonorPortalDto.GivingPage p = new TSAbcHopeDonorPortalDto.GivingPage();
    p.pageSize = GIVING_PAGE_SIZE;
    p.total = [
      SELECT COUNT()
      FROM GiftTransaction
      WHERE DonorId = :accountId AND Status NOT IN :EXCLUDED_STATUSES
    ];
    Integer pages = Math.max(
      1,
      (Integer) Math.ceil(p.total / (Decimal) GIVING_PAGE_SIZE)
    );
    p.page = Math.min(Math.max(page == null ? 1 : page, 1), pages);
    Integer offset = Math.min((p.page - 1) * GIVING_PAGE_SIZE, 2000); // SOQL OFFSET limit
    List<GiftTransaction> rows = [
      SELECT
        Id,
        Name,
        TransactionDate,
        CreatedDate,
        OriginalAmount,
        Status,
        Campaign.Name
      FROM GiftTransaction
      WHERE DonorId = :accountId AND Status NOT IN :EXCLUDED_STATUSES
      ORDER BY TransactionDate DESC NULLS LAST, CreatedDate DESC
      LIMIT :GIVING_PAGE_SIZE
      OFFSET :offset
    ];
    Map<Id, List<String>> designationsByTxn = new Map<Id, List<String>>();
    Map<Id, List<String>> programsByTxn = new Map<Id, List<String>>();
    for (GiftTransactionDesignation gtd : [
      SELECT
        GiftTransactionId,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId IN :rows AND GiftDesignationId != NULL
    ]) {
      if (!designationsByTxn.containsKey(gtd.GiftTransactionId)) {
        designationsByTxn.put(gtd.GiftTransactionId, new List<String>());
      }
      designationsByTxn.get(gtd.GiftTransactionId)
        .add(gtd.GiftDesignation.Name);
      TSAbcHopeCampaignService.addProgram(
        programsByTxn,
        gtd.GiftTransactionId,
        gtd.GiftDesignation.NGOTV_Program__r?.Name
      );
    }
    for (GiftTransaction gt : rows) {
      p.gifts.add(toGift(gt, designationsByTxn, programsByTxn));
    }
    return p;
  }

  static TSAbcHopeDonorPortalDto.Gift toGift(
    GiftTransaction gt,
    Map<Id, List<String>> designationsByTxn,
    Map<Id, List<String>> programsByTxn
  ) {
    TSAbcHopeDonorPortalDto.Gift g = new TSAbcHopeDonorPortalDto.Gift();
    g.id = gt.Id;
    g.name = gt.Name;
    g.giftDate = gt.TransactionDate != null
      ? gt.TransactionDate
      : gt.CreatedDate.date();
    g.amount = gt.OriginalAmount;
    g.status = gt.Status;
    g.campaignName = gt.Campaign?.Name;
    g.designations = designationsByTxn.containsKey(gt.Id)
      ? String.join(designationsByTxn.get(gt.Id), ', ')
      : '';
    g.programs = programsByTxn.containsKey(gt.Id)
      ? String.join(programsByTxn.get(gt.Id), ', ')
      : '';
    return g;
  }

  /** The donor's gifts that count (not cancelled, failed, refunded or written off), newest first. */
  static List<GiftTransaction> countedGifts(Id accountId) {
    return [
      SELECT
        Id,
        Name,
        TransactionDate,
        CreatedDate,
        OriginalAmount,
        Status,
        Campaign.Name
      FROM GiftTransaction
      WHERE DonorId = :accountId AND Status NOT IN :EXCLUDED_STATUSES
      ORDER BY TransactionDate DESC NULLS LAST, CreatedDate DESC
      LIMIT 200
    ];
  }

  /** Supporter since: the earliest of the account's creation year and its first counted gift. */
  static Integer supporterSinceYear(Account acc, List<GiftTransaction> gifts) {
    Integer year = acc.CreatedDate.year();
    for (GiftTransaction gt : gifts) {
      year = Math.min(year, giftYear(gt));
    }
    return year;
  }

  static Integer giftYear(GiftTransaction gt) {
    return gt.TransactionDate != null
      ? gt.TransactionDate.year()
      : gt.CreatedDate.year();
  }

  @TestVisible
  static Id accountIdOverride; // lets tests run without a community user licence

  public static Account currentAccount() {
    Id accountId = accountIdOverride;
    if (accountId == null && UserInfo.getUserType() != 'Guest') {
      for (User u : [
        SELECT Contact.AccountId
        FROM User
        WHERE Id = :UserInfo.getUserId() AND ContactId != NULL
      ]) {
        accountId = u.Contact.AccountId;
      }
    }
    if (accountId == null) {
      throw new PortalException('Please sign in to view your donor profile.');
    }
    return loadAccount(accountId);
  }

  public static Account loadAccount(Id accountId) {
    return [
      SELECT
        Id,
        Name,
        FirstName,
        LastName,
        IsPersonAccount,
        PersonEmail,
        Phone,
        PersonMobilePhone,
        PersonMailingStreet,
        PersonMailingCity,
        PersonMailingCountry,
        PersonHasOptedOutOfEmail,
        CreatedDate
      FROM Account
      WHERE Id = :accountId
    ];
  }

  static String clean(String value, Integer maxLength) {
    return value == null
      ? null
      : value.normalizeSpace().stripHtmlTags().abbreviate(maxLength);
  }
}
