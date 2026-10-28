// Idempotent (D-57): fill Program.Image_URL__c on active programs that have none. The three programs the dashboard
// stories feature get the photos those stories already showed; the others get the photo their /program page
// already showed (the theme photo for the name, as in c/tsAbcHopeCampaignPhotos). Edit the field to change a photo.
// Run: sf apex run -o npo-demo -f scripts/apex/seedProgramImages.apex
String base = 'https://images.unsplash.com/';
String q = '?auto=format&fit=crop&q=75';
Map<String, String> storyPhotos = new Map<String, String>{
  'Clean Water' => base + 'photo-1760873059715-7c7cfbe2a2c6' + q,
  'Education Access' => base + 'photo-1542810634-71277d95dcbb' + q,
  'Green Communities' => base + 'photo-1779085031158-a2519daf9747' + q
};
Map<String, String> themes = new Map<String, String>{
  'presents' => base + 'photo-1634038036367-7c0e7a95fa4c' + q,
  'meal' => base + 'photo-1766688350317-a74650b69e0e' + q,
  'christmas' => base + 'photo-1606916693216-69bd7e1cf2fa' + q,
  'water' => base + 'photo-1740741705746-74e6f9b93b4f' + q,
  'school' => base + 'photo-1573894998033-c0cef4ed722b' + q,
  'sprout' => base + 'photo-1678897482068-e89e03eb4a3a' + '?auto=format&fit=crop&crop=focalpoint&fp-x=0.45&fp-y=0.4&q=75',
  'gift' => base + 'photo-1488521787991-ed7bbaae773c' + q
};
List<Program> changed = new List<Program>();
for (Program p : [SELECT Id, Name FROM Program WHERE Status = 'Active' AND Image_URL__c = NULL]) {
  String url = storyPhotos.get(p.Name);
  if (url == null) {
    // Same keyword rule as campaignTheme() in c/tsAbcHopeCampaignPhotos.
    String n = p.Name.toLowerCase();
    String theme = Pattern.matches('.*(toy|present|wellbeing).*', n) ? 'presents'
      : Pattern.matches('.*(meal|food|family).*', n) ? 'meal'
      : n.contains('christmas') ? 'christmas'
      : n.contains('water') ? 'water'
      : Pattern.matches('.*(school|educat|scholar|girl).*', n) ? 'school'
      : Pattern.matches('.*(tree|green|environment|plant).*', n) ? 'sprout'
      : 'gift';
    url = themes.get(theme);
  }
  changed.add(new Program(Id = p.Id, Image_URL__c = url));
  System.debug(LoggingLevel.ERROR, 'IMAGE ' + p.Name + ' -> ' + url.substringBetween(base, '?'));
}
update changed;
System.debug(LoggingLevel.ERROR, 'Program images filled: ' + changed.size());
