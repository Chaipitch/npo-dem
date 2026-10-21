import { LightningElement } from 'lwc';

const RESOURCES = [
    {
        key: 'demo-hub',
        label: 'Slack Demo Hub',
        description: 'Slack Demo Hub for the Simple Demo Org (SDO).',
        url: 'https://www.solutionswork.space/content/resource/kA0g70000019JQQKA0/slack-demo-hub-for-the-simple-demo-org-sdo'
    },
    {
        key: 'demo-store',
        label: 'Demo Store - Slack Assets',
        description: 'Browse and find reusable Slack platform demo brix',
        url: 'https://www.solutionswork.space/demos/store?platform=slack'
    }
];

export default class SlackResources extends LightningElement {
    resources = RESOURCES;
}