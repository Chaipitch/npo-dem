public class NGO_CaseMan_ProgramDashboard_CTRL {

    public Id programRecordId { get; set; }
    public String filterValue { get; set; }
    
    public PageReference redirectToDashboard() {
        // Get the ID of the dashboard with the name 'NGO_CaseMan_ProgramRecord'
        Dashboard dashboard = [SELECT Id, DeveloperName FROM Dashboard WHERE DeveloperName = 'NGO_CaseMan_ProgramRecord' LIMIT 1];
        //rogram prog = [SELECt Id, Name FROM Program WHERE Id =: programRecordId LIMIT 1];
		//String urlSafe = prog.Name.escapeHTML3();
        // Redirect to the dashboard with the program record Id as a URL parameter
        PageReference dashboardPage = new PageReference('/lightning/r/Dashboard/'+dashboard.Id+'/view?queryScope=userFolders&fv0='+filterValue );
        dashboardPage.setRedirect(true);
        System.debug(dashboardPage);
        return dashboardPage;
    }
}