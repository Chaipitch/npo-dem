public class ngo_GrantmakingReviewerQuery {

@InvocableMethod(
        label='Get Grantmaking External Reviewers' 
        category='User'
    )
    public static List<ActionOutput> getReviewerIds() {
        ActionOutput result = new ActionOutput();
        Set<Id> userSet = new Set<Id>();
        
        for (PermissionSetAssignment psa : [
            SELECT AssigneeId 
            FROM PermissionSetAssignment 
            WHERE PermissionSet.Name IN ('GrantmakingExternalReviewer', 'GrantmkApplnReviewExternal')
            AND Assignee.IsActive = true
        ]) {
            userSet.add(psa.AssigneeId);
        }

        result.userIds = new List<Id>(userSet);

        // This list wraps the object for Flow's bulk engine
        return new List<ActionOutput>{result};
    }

    public class ActionOutput {
        @InvocableVariable(label='User ID Collection')
        public List<Id> userIds;
    }

}