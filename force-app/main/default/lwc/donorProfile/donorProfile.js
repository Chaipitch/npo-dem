import { LightningElement, api } from "lwc";
import basePath from "@salesforce/community/basePath";
import getProfile from "@salesforce/apex/DonorPortalController.getProfile";
import saveProfile from "@salesforce/apex/DonorPortalController.saveProfile";

const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const TABS = [
  { key: "profile", label: "My Profile" },
  { key: "communication", label: "Communication" },
  { key: "history", label: "Giving History" }
];

export default class DonorProfile extends LightningElement {
  @api givingPath = "/my-giving";

  profile;
  draft = {};
  activeTab = "profile";
  isLoading = true;
  isSaving = false;
  error;
  saveError;
  saved = false;
  errors = {};

  connectedCallback() {
    this.load();
  }

  async load() {
    try {
      this.profile = await getProfile();
      this.draft = toDraft(this.profile);
      this.error = undefined;
    } catch (e) {
      this.error = e.body?.message || "We could not load your profile.";
    } finally {
      this.isLoading = false;
    }
  }

  get tabs() {
    return TABS.map((t) => ({
      ...t,
      selected: t.key === this.activeTab,
      className: t.key === this.activeTab ? "tab tab_on" : "tab"
    }));
  }
  get isProfileTab() {
    return this.activeTab === "profile";
  }
  get isCommunicationTab() {
    return this.activeTab === "communication";
  }
  get isHistoryTab() {
    return this.activeTab === "history";
  }
  get fullName() {
    return this.profile
      ? `${this.profile.firstName || ""} ${this.profile.lastName || ""}`.trim()
      : "";
  }
  get initials() {
    return `${(this.profile?.firstName || " ")[0]}${(this.profile?.lastName || " ")[0]}`
      .trim()
      .toUpperCase();
  }
  get emailOptIn() {
    return !this.draft.emailOptOut;
  }
  get givingHref() {
    return `${basePath || ""}${this.givingPath}`;
  }
  get showSave() {
    return !this.isHistoryTab;
  }
  get saveLabel() {
    return this.isSaving ? "Saving…" : "Save Changes";
  }
  get firstNameError() {
    return this.errors.firstName;
  }
  get lastNameError() {
    return this.errors.lastName;
  }
  get emailError() {
    return this.errors.email;
  }

  handleTab(event) {
    this.activeTab = event.currentTarget.dataset.key;
  }
  handleInput(event) {
    const field = event.target.dataset.field;
    this.draft = { ...this.draft, [field]: event.target.value };
    this.saved = false;
    if (this.errors[field]) {
      const next = { ...this.errors };
      delete next[field];
      this.errors = next;
    }
  }
  handleOptIn(event) {
    this.draft = { ...this.draft, emailOptOut: !event.target.checked };
    this.saved = false;
  }

  validate() {
    const errors = {};
    if (!(this.draft.firstName || "").trim())
      errors.firstName = "Please enter your first name.";
    if (!(this.draft.lastName || "").trim())
      errors.lastName = "Please enter your last name.";
    if (!EMAIL_RE.test((this.draft.email || "").trim()))
      errors.email = "Please enter a valid email address.";
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  async handleSave() {
    if (this.isSaving || !this.validate()) {
      return;
    }
    this.isSaving = true;
    this.saveError = undefined;
    try {
      this.profile = await saveProfile({
        profileJson: JSON.stringify(this.draft)
      });
      this.draft = toDraft(this.profile);
      this.saved = true;
    } catch (e) {
      this.saveError = e.body?.message || "We could not save your profile.";
    } finally {
      this.isSaving = false;
    }
  }
}

const TEXT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "city",
  "country"
];

/**
 * Apex leaves empty fields out of its response, and an input given `undefined`
 * shows the word "undefined": empty fields become "" for the form.
 */
export function toDraft(profile) {
  const draft = { ...profile };
  for (const field of TEXT_FIELDS) {
    draft[field] = profile?.[field] ?? "";
  }
  return draft;
}
