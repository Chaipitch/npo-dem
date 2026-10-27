/** Agent action: update the verified donor's contact details. Only fields provided are changed. */
public without sharing class TSAbcHopeAgentUpdateProfile {
  static final Pattern EMAIL_PATTERN = Pattern.compile(
    '^[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
  );

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
      label='Email'
      description='New email address, if the donor asked to change it.'
    )
    public String email;
    @InvocableVariable(
      label='Phone'
      description='New phone number, if the donor asked to change it.'
    )
    public String phone;
    @InvocableVariable(
      label='Street'
      description='New street address, if provided.'
    )
    public String street;
    @InvocableVariable(label='City' description='New city, if provided.')
    public String city;
    @InvocableVariable(label='Country' description='New country, if provided.')
    public String country;
  }

  public class Result {
    @InvocableVariable(label='Success')
    public Boolean success = false;
    @InvocableVariable(
      label='Message'
      description='What happened, to relay to the donor.'
    )
    public String message;
  }

  @InvocableMethod(
    label='ABC Hope: Update My Contact Details'
    description='For a signed-in individual donor: updates email, phone and/or mailing address. Only the fields provided are changed.'
  )
  public static List<Result> updateDetails(List<Request> requests) {
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
      r.message = 'The user is not signed in. Contact details can only be changed after signing in on the ABC Hope site.';
      return r;
    }
    Account acc = TSAbcHopeDonorPortalController.loadAccount(accountId);
    if (!acc.IsPersonAccount) {
      r.message = 'Only individual donor profiles can be updated here.';
      return r;
    }
    Account upd = new Account(Id = acc.Id);
    List<String> changed = new List<String>();
    String email = TSAbcHopeAgentSupport.clean(req.email, 80);
    if (String.isNotBlank(email)) {
      if (!EMAIL_PATTERN.matcher(email).matches()) {
        r.message = 'That email address doesn\'t look valid. Ask the donor to check it.';
        return r;
      }
      upd.PersonEmail = email.toLowerCase();
      changed.add('email');
    }
    if (String.isNotBlank(req.phone)) {
      upd.PersonMobilePhone = TSAbcHopeAgentSupport.clean(req.phone, 40);
      changed.add('phone');
    }
    if (String.isNotBlank(req.street)) {
      upd.PersonMailingStreet = TSAbcHopeAgentSupport.clean(req.street, 255);
      changed.add('street');
    }
    if (String.isNotBlank(req.city)) {
      upd.PersonMailingCity = TSAbcHopeAgentSupport.clean(req.city, 40);
      changed.add('city');
    }
    if (String.isNotBlank(req.country)) {
      upd.PersonMailingCountry = TSAbcHopeAgentSupport.clean(req.country, 80);
      changed.add('country');
    }
    if (changed.isEmpty()) {
      r.message = 'Nothing to update. Ask which details the donor wants to change.';
      return r;
    }
    try {
      update upd;
      r.success = true;
      r.message = 'Updated ' + String.join(changed, ', ') + '.';
    } catch (DmlException e) {
      r.message = 'The details could not be saved: ' + e.getDmlMessage(0);
    }
    return r;
  }
}
