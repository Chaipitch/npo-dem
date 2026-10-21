/**
 * @description Trigger on Program object to handle cascading updates to related records
 * @author Salesforce
 * @date 2026
 */
trigger ngo_ProgramTrigger on Program (after update) {
    ngo_ProgramTriggerHandler.handleAfterUpdate(Trigger.new, Trigger.oldMap);
}