/**
 * Agent action: facts about ABC Hope's fundraising campaigns and how to give. Safe for guests.
 * With no campaign name it lists every campaign open for gifts (same rule as the dashboard
 * cards, D-18); with a name it describes that campaign. Only fundraising campaigns (those with
 * a GiftDefaultDesignation) are ever described, so internal campaigns stay hidden.
 */
public without sharing class AbcHopeAgentCampaignInfo {
  public class Request {
    @InvocableVariable(
      label='Campaign name'
      description='Campaign to describe. Leave empty to list every campaign open for donations.'
    )
    public String campaignName;
  }

  public class Result {
    @InvocableVariable(
      label='Campaign summary'
      description='Plain-text facts about the campaigns, what they fund and how to give.'
    )
    public String summary;
    @InvocableVariable(
      label='Donate URL'
      description='Link to the donation page on the ABC Hope site.'
    )
    public String donateUrl;
  }

  // The site's donation page shows this admin-configured cause list for its default campaign.
  static final String CONFIGURED_CAMPAIGN = 'Christmas Giving 2026';
  static final List<String> CONFIGURED_DESIGNATIONS = new List<String>{
    'School Supplies',
    'Learning Kits',
    DonationIntakeService.GENERAL_DESIGNATION
  };

  static final String GIVING_FACTS = 'Suggested amounts: USD 300, USD 500, USD 1,000, or any amount from USD 100. Gifts can be one-time or recurring (weekly, monthly or yearly).';
  static final String DONOR_FACTS = 'Individuals and organizations can give. Donors only need a name and email; signed-in donors skip that step.';
  static final String DEMO_FACTS = 'This is a demo site: no payment is collected when a gift is submitted.';

  @InvocableMethod(
    label='ABC Hope: Get Campaign Info'
    description='Lists the ABC Hope campaigns open for donations, or describes one campaign: purpose, dates, progress, causes you can support, suggested amounts and the donation link.'
  )
  public static List<Result> getInfo(List<Request> requests) {
    List<DonationIntakeService.CampaignCard> open = DonationIntakeService.getCampaigns();
    List<Result> results = new List<Result>();
    for (Request req : requests) {
      String name = AbcHopeAgentSupport.clean(req?.campaignName, 80);
      results.add(String.isBlank(name) ? listOpen(open) : describe(name, open));
    }
    return results;
  }

  static Result listOpen(List<DonationIntakeService.CampaignCard> open) {
    Result r = new Result();
    r.donateUrl = AbcHopeAgentSupport.siteUrl('/donate');
    List<String> lines = new List<String>();
    if (open.isEmpty()) {
      lines.add('No campaigns are open for donations right now.');
    } else {
      lines.add(
        'ABC Hope has ' +
          open.size() +
          (open.size() == 1 ? ' campaign' : ' campaigns') +
          ' open for donations:'
      );
      Integer i = 1;
      for (DonationIntakeService.CampaignCard card : open) {
        lines.add(
          String.valueOf(i++) +
            '. ' +
            card.name +
            ' — ' +
            purpose(card.description) +
            ' ' +
            funds(card.programs) +
            progress(card) +
            ' Donate: ' +
            donateUrl(card.name)
        );
      }
    }
    lines.add(GIVING_FACTS);
    lines.add(DEMO_FACTS);
    r.summary = String.join(lines, '\n');
    return r;
  }

  static Result describe(
    String name,
    List<DonationIntakeService.CampaignCard> open
  ) {
    Result r = new Result();
    Campaign c = findCampaign(name);
    if (c == null) {
      r.donateUrl = AbcHopeAgentSupport.siteUrl('/donate');
      List<String> names = new List<String>();
      for (DonationIntakeService.CampaignCard card : open) {
        names.add(card.name);
      }
      r.summary =
        'There is no campaign called "' +
        name +
        '". ' +
        (names.isEmpty()
          ? 'No campaigns are open for donations right now.'
          : 'Campaigns open for donations: ' + String.join(names, '; ') + '.');
      return r;
    }
    DonationIntakeService.CampaignCard card;
    for (DonationIntakeService.CampaignCard o : open) {
      if (o.id == String.valueOf(c.Id)) {
        card = o;
      }
    }
    r.donateUrl = card == null
      ? AbcHopeAgentSupport.siteUrl('/donate')
      : donateUrl(c.Name);
    List<String> lines = new List<String>{
      'Campaign: ' +
      c.Name +
      (card == null ? ' (not currently accepting gifts)' : ''),
      'Purpose: ' + purpose(c.Description),
      'Dates: ' +
      (c.StartDate == null ? 'open' : c.StartDate.format()) +
      ' to ' +
      (c.EndDate == null ? 'open' : c.EndDate.format())
    };
    if (card != null) {
      if (!card.programs.isEmpty()) {
        lines.add('Programs funded: ' + String.join(card.programs, ', '));
      }
      lines.add('Progress: ' + progress(card));
    }
    lines.add('Causes donors can choose: ' + causes(c));
    lines.add(GIVING_FACTS);
    lines.add(DONOR_FACTS);
    lines.add(DEMO_FACTS);
    lines.add(
      card == null
        ? 'This campaign is closed. Ask about the campaigns open for donations instead.'
        : 'Donate here: ' + r.donateUrl
    );
    r.summary = String.join(lines, '\n');
    return r;
  }

  /** Exact name first, then a partial match; open campaigns win over closed ones. */
  static Campaign findCampaign(String name) {
    String pattern = '%' + name + '%';
    List<Campaign> candidates = [
      SELECT Id, Name, Description, StartDate, EndDate, IsActive
      FROM Campaign
      WHERE Name = :name OR Name LIKE :pattern
      ORDER BY IsActive DESC, EndDate DESC NULLS FIRST, Name
      LIMIT 50
    ];
    Set<Id> fundraising = new Set<Id>();
    for (GiftDefaultDesignation gdd : [
      SELECT ParentRecordId
      FROM GiftDefaultDesignation
      WHERE ParentRecordId IN :candidates
    ]) {
      fundraising.add(gdd.ParentRecordId);
    }
    Campaign best;
    for (Campaign c : candidates) {
      if (!fundraising.contains(c.Id)) {
        continue;
      }
      if (c.Name.equalsIgnoreCase(name)) {
        return c;
      }
      if (best == null) {
        best = c;
      }
    }
    return best;
  }

  static String causes(Campaign c) {
    List<String> wanted = new List<String>();
    if (c.Name == CONFIGURED_CAMPAIGN) {
      wanted.addAll(CONFIGURED_DESIGNATIONS);
    } else {
      for (GiftDefaultDesignation gdd : [
        SELECT GiftDesignation.Name
        FROM GiftDefaultDesignation
        WHERE ParentRecordId = :c.Id AND GiftDesignation.IsActive = TRUE
        ORDER BY AllocatedPercentage DESC, CreatedDate ASC
      ]) {
        wanted.add(gdd.GiftDesignation.Name);
      }
      wanted.add(DonationIntakeService.GENERAL_DESIGNATION);
    }
    Map<String, GiftDesignation> byName = new Map<String, GiftDesignation>();
    for (GiftDesignation gd : [
      SELECT Name, Description, NGOTV_Program__r.Name
      FROM GiftDesignation
      WHERE IsActive = TRUE AND Name IN :wanted
    ]) {
      byName.put(gd.Name, gd);
    }
    List<String> out = new List<String>();
    for (String n : wanted) {
      GiftDesignation gd = byName.remove(n); // remove: skip duplicate names
      if (gd != null) {
        String program = gd.NGOTV_Program__r?.Name;
        out.add(
          gd.Name +
            (String.isBlank(program) ? '' : ' (' + program + ' program)') +
            (String.isBlank(gd.Description) ? '' : ' — ' + gd.Description)
        );
      }
    }
    return out.isEmpty()
      ? DonationIntakeService.GENERAL_DESIGNATION
      : String.join(out, '; ');
  }

  static String purpose(String description) {
    return String.isBlank(description)
      ? 'Supports ABC Hope\'s work with children.'
      : AbcHopeAgentSupport.clean(description, 300);
  }

  /** "Funds: A, B. " — the programs a campaign spends gifts on (D-21); empty when none. */
  static String funds(List<String> programs) {
    return programs == null || programs.isEmpty()
      ? ''
      : 'Funds: ' + String.join(programs, ', ') + '. ';
  }

  static String progress(DonationIntakeService.CampaignCard card) {
    String text =
      'Raised ' +
      AbcHopeAgentSupport.money(card.raised) +
      (card.goal == null ||
        card.goal <= 0
        ? ''
        : ' of a ' + AbcHopeAgentSupport.money(card.goal) + ' goal') +
      ' from ' +
      card.giftCount +
      (card.giftCount == 1 ? ' gift' : ' gifts') +
      '.';
    if (card.endDate != null) {
      text +=
        ' Ends ' +
        card.endDate.format() +
        (card.daysLeft == 0
          ? ' (last day today).'
          : ' (' +
            card.daysLeft +
            (card.daysLeft == 1 ? ' day' : ' days') +
            ' left).');
    }
    return text;
  }

  static String donateUrl(String campaignName) {
    return AbcHopeAgentSupport.siteUrl(
      '/donate?campaign=' +
      EncodingUtil.urlEncode(campaignName, 'UTF-8').replace('+', '%20')
    );
  }
}
