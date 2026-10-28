// Idempotent (D-56): fill Campaign.Image_URL__c on ABC Hope fundraising campaigns that have none, with the photo
// the site already shows for them (the theme photo chosen from the name in c/tsAbcHopeCampaignPhotos), so nothing
// changes on the site. Edit the field on a campaign afterwards to show another photo.
// Run: sf apex run -o npo-demo -f scripts/apex/seedCampaignImages.apex
String base = 'https://images.unsplash.com/';
String q = '?auto=format&fit=crop&q=75';
Map<String, String> photos = new Map<String, String>{
  'presents' => base + 'photo-1634038036367-7c0e7a95fa4c' + q,
  'meal' => base + 'photo-1766688350317-a74650b69e0e' + q,
  'christmas' => base + 'photo-1606916693216-69bd7e1cf2fa' + q,
  'water' => base + 'photo-1740741705746-74e6f9b93b4f' + q,
  'school' => base + 'photo-1573894998033-c0cef4ed722b' + q,
  'sprout' => base + 'photo-1678897482068-e89e03eb4a3a' + '?auto=format&fit=crop&crop=focalpoint&fp-x=0.45&fp-y=0.4&q=75',
  'gift' => base + 'photo-1488521787991-ed7bbaae773c' + q
};
List<Campaign> changed = new List<Campaign>();
for (Campaign c : [
  SELECT Id, Name, Image_URL__c
  FROM Campaign
  WHERE Id IN (SELECT ParentRecordId FROM GiftDefaultDesignation) AND Image_URL__c = NULL
]) {
  // Same keyword rule as campaignTheme() in c/tsAbcHopeCampaignPhotos.
  String n = c.Name.toLowerCase();
  String theme = Pattern.matches('.*(toy|present|wellbeing).*', n) ? 'presents'
    : Pattern.matches('.*(meal|food|family).*', n) ? 'meal'
    : n.contains('christmas') ? 'christmas'
    : n.contains('water') ? 'water'
    : Pattern.matches('.*(school|educat|scholar|girl).*', n) ? 'school'
    : Pattern.matches('.*(tree|green|environment|plant).*', n) ? 'sprout'
    : 'gift';
  changed.add(new Campaign(Id = c.Id, Image_URL__c = photos.get(theme)));
  System.debug(LoggingLevel.ERROR, 'IMAGE ' + c.Name + ' -> ' + theme);
}
update changed;
System.debug(LoggingLevel.ERROR, 'Campaign images filled: ' + changed.size());
