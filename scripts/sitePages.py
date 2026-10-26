"""Generate LWR route/view JSON for ABC Hope custom pages.

Usage: python3 scripts/sitePages.py
Each page = one section, one column, one custom LWC (plus the SEO component).
"""
import json, os, uuid

SITE = 'force-app/main/default/digitalExperiences/site/ABC_Hope1'

def uid():
    return str(uuid.uuid4())

def section(components):
    sec_id, col_id = uid(), uid()
    config = {"UUID": sec_id, "columns": [{"UUID": col_id, "columnName": "Column 1", "columnKey": "col1", "columnWidth": "12", "seedComponents": None}]}
    return {
        "attributes": {
            "backgroundImageConfig": "", "backgroundImageOverlay": "rgba(0,0,0,0)", "componentSpacerSize": "",
            "layoutDirectionDesktop": "row", "layoutDirectionMobile": "column", "layoutDirectionTablet": "column",
            "maxContentWidth": "", "sectionColumnGutterWidth": "", "sectionConfig": json.dumps(config, separators=(',', ':')),
            "sectionMinHeight": "", "sectionVerticalAlign": "flex-start"
        },
        "children": [{
            "children": [{"attributes": attrs, "definition": definition, "id": uid(), "type": "component"} for definition, attrs in components],
            "id": col_id, "name": "col1", "title": "Column 1", "type": "region"
        }],
        "definition": "community_layout:section", "id": sec_id, "type": "component"
    }

def view(api_name, title, view_type, sections, layout_type='Inner'):
    return {
        "type": "sfdc_cms__view",
        "title": title,
        "contentBody": {
            "component": {
                "children": [
                    {"children": sections, "id": uid(), "name": "content", "title": "Content", "type": "region"},
                    {"children": [{"attributes": {"customHeadTags": "", "description": "", "pageTitle": title, "recordId": "{!recordId}"},
                                   "definition": "community_builder:seoAssistant", "id": uid(), "type": "component"}],
                     "id": uid(), "name": "sfdcHiddenRegion", "title": "sfdcHiddenRegion", "type": "region"}
                ],
                "definition": "community_layout:sldsFlexibleLayout", "id": uid(), "type": "component"
            },
            "dataProviders": [], "themeLayoutType": layout_type, "viewType": view_type
        },
        "urlName": api_name.lower()
    }

def write(kind, api_name, content, keep_meta=True):
    d = os.path.join(SITE, kind, api_name)
    os.makedirs(d, exist_ok=True)
    meta_path = os.path.join(d, '_meta.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {"apiName": api_name, "type": kind, "path": "routes" if kind == 'sfdc_cms__route' else "views"}
    json.dump(meta, open(meta_path, 'w'), indent=2)
    json.dump(content, open(os.path.join(d, 'content.json'), 'w'), indent=2)

def custom_page(route_api, view_api, title, url, access, components, layout_type='Inner'):
    write('sfdc_cms__route', route_api, {
        "type": "sfdc_cms__route", "title": title,
        "contentBody": {"activeViewId": view_api, "configurationTags": [], "pageAccess": access,
                        "routeType": f"custom-{url}", "urlPrefix": url},
        "urlName": url})
    write('sfdc_cms__view', view_api, view(view_api, title, f"custom-{url}", [section(components)], layout_type))

# Chat window (Embedded Messaging, D-25) on every page except the dashboard, which has the Ask panel.
# Deployment ABC_Hope_Web_Chat is hosted on its own ESW site (created in Setup); site authentication verifies
# signed-in donors, guests chat unverified.
CHAT = ("experience_messaging:embeddedMessaging", {
    "clientVersion": "WebV1",
    "deploymentName": "ABC_Hope_Web_Chat",
    "hideChatButtonOnLoad": "Visible",
    "isExpSiteAuthMode": True,
    "scrtUrl": "https://te1791557923677.my.salesforce-scrt.com",
    "siteEndpoint": "https://te1791557923677.my.site.com/ESWABCHopeWebC1792985313558",
})

# Home = Discover step
write('sfdc_cms__view', 'home', view('home', 'Home', 'home', [section([("c:abcHopeHero", {}), CHAT])]))

custom_page('Donate__c', 'donate', 'Donate', 'donate', 'Public', [("c:donationJourney", {}), CHAT])
custom_page('Dashboard__c', 'dashboard', 'Dashboard', 'dashboard', 'RequiresLogin', [("c:donorDashboard", {"view": "home"})], 'Portal')
custom_page('My_Giving__c', 'myGiving', 'My Giving', 'my-giving', 'RequiresLogin', [("c:donorDashboard", {"view": "giving"}), CHAT], 'Portal')
custom_page('My_Profile__c', 'myProfile', 'My Profile', 'my-profile', 'RequiresLogin', [("c:donorProfile", {}), CHAT], 'Portal')
custom_page('Campaign__c', 'campaign', 'Campaign', 'campaign', 'RequiresLogin', [("c:campaignDetail", {}), CHAT], 'Portal')

# Home must be public too.
home_route = os.path.join(SITE, 'sfdc_cms__route', 'Home', 'content.json')
r = json.load(open(home_route)); r['contentBody']['pageAccess'] = 'Public'
json.dump(r, open(home_route, 'w'), indent=2)

# Site-level: allow guest access.
site_dir = os.path.join(SITE, 'sfdc_cms__site')
for name in os.listdir(site_dir):
    p = os.path.join(site_dir, name, 'content.json')
    s = json.load(open(p)); s['contentBody']['authenticationType'] = 'AUTHENTICATED_WITH_PUBLIC_ACCESS_ENABLED'
    json.dump(s, open(p, 'w'), indent=2)
print('pages written')

def theme_layout(api, title, definition, url):
    d = os.path.join(SITE, 'sfdc_cms__themeLayout', api)
    os.makedirs(d, exist_ok=True)
    meta_path = os.path.join(d, '_meta.json')
    if not os.path.exists(meta_path):
        json.dump({"apiName": api, "type": "sfdc_cms__themeLayout", "path": "themeLayouts"}, open(meta_path, 'w'), indent=2)
    json.dump({"type": "sfdc_cms__themeLayout", "title": title, "contentBody": {"component": {
        "attributes": {},
        "children": [{"id": uid(), "name": "header", "title": "Header", "type": "region"},
                     {"id": uid(), "name": "footer", "title": "Footer", "type": "region"}],
        "definition": definition, "id": uid(), "type": "component"}}, "urlName": url},
        open(os.path.join(d, 'content.json'), 'w'), indent=2)

theme_layout('abcPublicLayout', 'ABC Hope Public', 'c:abcHopePublicLayout', 'abc-hope-public')
theme_layout('abcPortalLayout', 'ABC Hope Portal', 'c:abcHopePortalLayout', 'abc-hope-portal')
theme_dir = os.path.join(SITE, 'sfdc_cms__theme')
for name in os.listdir(theme_dir):
    p = os.path.join(theme_dir, name, 'content.json')
    t = json.load(open(p))
    keep = [l for l in t['contentBody']['layouts'] if l['layoutType'] not in ('Inner', 'Portal')]
    t['contentBody']['layouts'] = keep + [{"layoutId": "abcPublicLayout", "layoutType": "Inner"},
                                          {"layoutId": "abcPortalLayout", "layoutType": "Portal"}]
    json.dump(t, open(p, 'w'), indent=2)
print('theme layouts written')
