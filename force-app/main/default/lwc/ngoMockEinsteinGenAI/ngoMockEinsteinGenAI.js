import { LightningElement, api, track } from 'lwc';
import EINSTEIN_LOGO1 from "@salesforce/resourceUrl/NGO_Mock_1";

export default class NgoMockEinsteinGenAI extends LightningElement {
    @api title = ''

    homeImg= EINSTEIN_LOGO1;

    homePage = true;
    loadingPage = false;
    summaryPage = false;
    @api summary = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

    handleHomeButtonClick(){
        this.homePage = !this.homePage
        this.loadingPage = !this.loadingPage
    }

    handleLoadingButtonClick(){
        this.loadingPage = !this.loadingPage
        this.summaryPage = !this.summaryPage
    }

    handleSummaryButtonClick(){
        this.summaryPage = !this.summaryPage
        this.homePage = !this.homePage
    }
}