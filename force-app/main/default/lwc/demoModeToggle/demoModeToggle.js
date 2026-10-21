import { LightningElement, api, wire } from 'lwc';
import { updateRecord } from 'lightning/uiRecordApi';
import { gql, graphql, refreshGraphQL } from 'lightning/uiGraphQLApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import RUNNING_USER_ID from '@salesforce/user/Id';

export default class DemoModeToggle extends LightningElement {
    // Seconds to wait after the save commits before reloading, giving the
    // FlexiPage component-visibility context time to pick up the new value.
    // Configurable in App Builder; defaults to 5 seconds.
    @api refreshDelaySeconds = 5;

    runningUserId = RUNNING_USER_ID;
    isSaving = false;
    graphQLResult;
    error;

    get refreshDelayMs() {
        const seconds = Number(this.refreshDelaySeconds);
        return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 5000;
    }

    @wire(graphql, {
        query: gql`
            query ActiveUsersDemoMode {
                uiapi {
                    query {
                        User(
                            where: {
                                and: [
                                    { IsActive: { eq: true } }
                                    { UserType: { eq: "Standard" } }
                                ]
                            }
                            first: 200
                        ) {
                            edges {
                                node {
                                    Id
                                    Demo_Mode__c {
                                        value
                                    }
                                    Profile {
                                        Name {
                                            value
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `
    })
    handleGraphQL(result) {
        this.graphQLResult = result;
        this.error = result.error;
    }

    get activeUsers() {
        const edges = this.graphQLResult?.data?.uiapi?.query?.User?.edges ?? [];
        return edges
            .map((edge) => edge.node)
            .filter((u) => {
                const profileName = u.Profile?.Name?.value ?? '';
                return !profileName.includes('Integration');
            });
    }

    get isLoading() {
        return !this.graphQLResult || (!this.graphQLResult.data && !this.graphQLResult.error);
    }

    get isDemoModeOn() {
        const me = this.activeUsers.find((u) => u.Id === this.runningUserId);
        return me?.Demo_Mode__c?.value === true;
    }

    get statusMessage() {
        return this.isDemoModeOn ? 'Demo Mode is currently ON.' : 'Demo Mode is currently OFF';
    }

    get buttonLabel() {
        return this.isDemoModeOn ? 'Disable Demo Mode' : 'Enable Demo Mode';
    }

    get buttonVariant() {
        return this.isDemoModeOn ? 'destructive' : 'brand';
    }

    async handleToggle() {
        this.isSaving = true;
        const newValue = !this.isDemoModeOn;
        const usersToUpdate = this.activeUsers.filter(
            (u) => u.Demo_Mode__c?.value !== newValue
        );

        if (usersToUpdate.length === 0) {
            this.isSaving = false;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'No changes needed',
                    message: `All active users are already ${newValue ? 'ON' : 'OFF'}.`,
                    variant: 'info'
                })
            );
            return;
        }

        const results = await Promise.allSettled(
            usersToUpdate.map((u) =>
                updateRecord({ fields: { Id: u.Id, Demo_Mode__c: newValue } })
            )
        );

        const failures = [];
        results.forEach((r, idx) => {
            if (r.status === 'rejected') {
                const userId = usersToUpdate[idx].Id;
                const err = r.reason;
                const message = err?.body?.message || err?.body?.output?.errors?.[0]?.message || err?.message || 'Unknown error';
                // eslint-disable-next-line no-console
                console.error(`[demoModeToggle] Failed for User ${userId}:`, message, err);
                failures.push({ userId, message });
            }
        });

        const successCount = usersToUpdate.length - failures.length;

        if (failures.length === 0) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Demo Mode Updated',
                    message: `Demo Mode is now ${newValue ? 'ON' : 'OFF'} for ${successCount} user${successCount === 1 ? '' : 's'}.`,
                    variant: 'success'
                })
            );
            // The updateRecord calls above have already committed server-side, but
            // the running-user context that FlexiPage component-visibility rules
            // evaluate against refreshes on its own cadence and lags behind the
            // record write by a few seconds. That path is not observable from this
            // component (polling our own GraphQL query returns the LDS-cached value,
            // which flips optimistically on save), so we wait a fixed settle window
            // before reloading to give the visibility context time to catch up.
            await this.delay(this.refreshDelayMs);
            // eslint-disable-next-line no-restricted-globals
            window.location.reload();
        } else {
            await refreshGraphQL(this.graphQLResult);
            // eslint-disable-next-line no-console
            console.table(failures);
            const first = failures[0];
            this.dispatchEvent(
                new ShowToastEvent({
                    title: `Demo Mode: ${successCount} succeeded, ${failures.length} failed`,
                    message: `First failure — User ${first.userId}: ${first.message}. See browser console for full list.`,
                    variant: 'warning',
                    mode: 'sticky'
                })
            );
        }

        this.isSaving = false;
    }

    delay(ms) {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}