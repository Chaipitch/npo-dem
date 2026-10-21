/** Agent action: facts about the current ABC Hope campaign and how to give. Safe for guests. */
public without sharing class AbcHopeAgentCampaignInfo {
  public class Request {
    @InvocableVariable(
      label='Campaign name'
      description='Campaign to describe. Defaults to Christmas Giving 2026.'
    )
    public String campaignName;
  }

  public class Result {
    @InvocableVariable(
      label='Campaign summary'
      description='Plain-text facts about the campaign, what it funds and how to give.'
    )
    public String summary;
    @InvocableVariable(
      label='Donate URL'
      description='Link to the donation page on the ABC Hope site.'
    )
    public String donateUrl;
  }

  static final List<String> DESIGNATIONS = new List<String>{
    'School Supplies',
    'Learning Kits',
    'Where Most Needed'
  };

  @InvocableMethod(
    label='ABC Hope: Get Campaign Info'
    description='Returns facts about the ABC Hope Christmas Giving campaign: purpose, dates, causes you can support, suggested amounts and the donation link.'
  )
  public static List<Result> getInfo(List<Request> requests) {
    List<Result> results = new List<Result>();
    for (Request req : requests) {
      String name = String.isBlank(req?.campaignName)
        ? 'Christmas Giving 2026'
        : AbcHopeAgentSupport.clean(req.campaignName, 80);
      Result r = new Result();
      r.donateUrl = AbcHopeAgentSupport.siteUrl('/donate');
      List<Campaign> camps = [
        SELECT Name, Description, StartDate, EndDate, IsActive
        FROM Campaign
        WHERE Name = :name
        LIMIT 1
      ];
      if (camps.isEmpty()) {
        r.summary =
          'There is no campaign called "' +
          name +
          '". The current campaign is Christmas Giving 2026.';
        results.add(r);
        continue;
      }
      Campaign c = camps[0];
      List<String> causes = new List<String>();
      for (GiftDesignation gd : [
        SELECT Name, Description
        FROM GiftDesignation
        WHERE IsActive = TRUE AND Name IN :DESIGNATIONS
        ORDER BY Name
      ]) {
        causes.add(
          gd.Name +
          (String.isBlank(gd.Description) ? '' : ' — ' + gd.Description)
        );
      }
      List<String> lines = new List<String>{
        'Campaign: ' +
        c.Name +
        (c.IsActive ? '' : ' (not currently accepting gifts)'),
        'Purpose: ' +
        (String.isBlank(c.Description)
          ? 'Support children\'s education this Christmas.'
          : c.Description),
        'Dates: ' +
        (c.StartDate == null ? 'open' : c.StartDate.format()) +
        ' to ' +
        (c.EndDate == null ? 'open' : c.EndDate.format()),
        'Causes donors can choose: ' +
        (causes.isEmpty() ? 'Where Most Needed' : String.join(causes, '; ')),
        'Suggested amounts: THB 300, THB 500, THB 1,000, or any amount from THB 100. Gifts can be one-time or monthly.',
        'Individuals and organizations can give. Donors only need a name and email; signed-in donors skip that step.',
        'This is a demo site: no payment is collected when a gift is submitted.',
        'Donate here: ' + r.donateUrl
      };
      r.summary = String.join(lines, '\n');
      results.add(r);
    }
    return results;
  }
}
