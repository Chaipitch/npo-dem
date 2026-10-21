public class AppMenuReorderQueueable implements Queueable {
    private List<Id> appIds;
    
    public AppMenuReorderQueueable(List<Id> appIds) {
        this.appIds = appIds;
    }
    
    public void execute(QueueableContext context) {
        try {
            AppLauncher.AppMenu.setOrgSortOrder(appIds);
            AppLauncher.AppMenu.setUserSortOrder(appIds);
            System.debug('App Menu reordering completed successfully');
        } catch (Exception e) {
            System.debug('Error in queueable: ' + e.getMessage());
        }
    }
}