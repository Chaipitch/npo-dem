import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOrgUsers from '@salesforce/apex/SlackOrgLinkController.getOrgUsers';
import getUserMagicLink from '@salesforce/apex/SlackOrgLinkController.getUserMagicLink';

// Stable prefix of SlackOrgLinkController.DETAILS_MISSING_MESSAGE — used to
// distinguish "Slack Org not connected" from a real callout failure.
const NOT_CONNECTED_MESSAGE_PREFIX = 'No Slack Org details';

export default class SlackUsersList extends LightningElement {
    usersData;
    usersError;
    loading = true;
    // true once getOrgUsers returns successfully; false when the controller
    // signals Slack__mdt has no row (brix not installed); undefined while
    // loading or on a generic error so neither empty state shows.
    slackOrgConnected;
    loginInFlight = new Set();
    searchTerm = '';

    connectedCallback() {
        this.loadUsers();
    }

    async loadUsers() {
        this.loading = true;
        this.usersError = undefined;
        try {
            this.usersData = await getOrgUsers();
            this.slackOrgConnected = true;
        } catch (err) {
            const msg = err?.body?.message || err?.message || '';
            if (msg.startsWith(NOT_CONNECTED_MESSAGE_PREFIX)) {
                this.slackOrgConnected = false;
                this.usersData = [];
            } else {
                this.usersError = err;
                this.usersData = undefined;
            }
        } finally {
            this.loading = false;
        }
    }

    get isLoading() {
        return this.loading;
    }

    get hasError() {
        return Boolean(this.usersError);
    }

    get errorMessage() {
        const err = this.usersError;
        if (!err) return null;
        return err.body?.message || err.message || 'Unknown error loading Slack users.';
    }

    get users() {
        return this.usersData ?? [];
    }

    get hasUsers() {
        return this.users.length > 0;
    }

    get visibleUsers() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.users;
        return this.users.filter((u) => {
            const haystack = [u.displayName, u.slackUserName, u.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }

    get hasVisibleUsers() {
        return this.visibleUsers.length > 0;
    }

    get isSearchDisabled() {
        return this.isLoading || this.hasError || !this.hasUsers;
    }

    // Brix-not-installed empty state: shown when the gate returned false.
    get showBrixMissing() {
        return !this.isLoading && !this.hasError && this.slackOrgConnected === false;
    }

    // Connected-but-no-users empty state: distinct from the brix-missing case
    // so presenters know whether the issue is install vs. data.
    get showEmpty() {
        return (
            !this.isLoading &&
            !this.hasError &&
            this.slackOrgConnected === true &&
            !this.hasUsers
        );
    }

    get showNoMatches() {
        return this.hasUsers && !this.hasVisibleUsers && this.searchTerm.trim().length > 0;
    }

    get titleLabel() {
        const total = this.users.length;
        return `Users (${total})`;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value ?? '';
    }

    async handleLoginAs(event) {
        const slackUserName = event.currentTarget?.dataset?.slackUserName;
        if (!slackUserName) return;
        if (this.loginInFlight.has(slackUserName)) return;

        this.loginInFlight.add(slackUserName);
        try {
            const link = await getUserMagicLink({ slackUserName });
            window.open(link, '_blank', 'noopener,noreferrer');
        } catch (err) {
            const message =
                err?.body?.message || err?.message || 'Could not generate Slack magic login link.';
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Login failed',
                    message,
                    variant: 'error'
                })
            );
        } finally {
            this.loginInFlight.delete(slackUserName);
        }
    }

}