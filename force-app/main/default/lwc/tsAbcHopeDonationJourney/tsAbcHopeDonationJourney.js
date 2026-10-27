import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import basePath from "@salesforce/community/basePath";
import getOptions from "@salesforce/apex/TSAbcHopeDonationIntakeController.getOptions";
import submitDonation from "@salesforce/apex/TSAbcHopeDonationIntakeController.submitDonation";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";
import { campaignPhoto } from "c/tsAbcHopeCampaignPhotos";
import { markGiftsChanged } from "c/tsAbcHopeGiftEvents";

const STEPS = [
  { key: "choose", label: "Choose Donation" },
  { key: "details", label: "Your Details" },
  { key: "review", label: "Review & Submit" },
  { key: "thanks", label: "Thank You" }
];
const ONE_TIME = "One-time";
/** Seconds on the thank-you step before a signed-in donor goes to the dashboard. */
const REDIRECT_SECONDS = 5;
const RECURRING = "Recurring";
// Recurring periods; the chosen one is sent to Apex as the frequency (D-24).
const PERIODS = [
  { value: "Weekly", unit: "week" },
  { value: "Monthly", unit: "month" },
  { value: "Yearly", unit: "year" }
];
const DEFAULT_PERIOD = "Monthly";
const INDIVIDUAL = "Individual";
const ORGANIZATION = "Organization";
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000000;
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export default class DonationJourney extends LightningElement {
  @api campaignName = "Christmas Giving 2026";
  @api designationNames = "School Supplies,Learning Kits,Where Most Needed";
  @api amountOptions = "300,500,1000";
  @api defaultAmount = 1000;
  @api currencyLabel = "USD";
  @api heading = "Choose your donation";
  @api subheading =
    "Your support helps provide education opportunities for children in need.";
  @api reviewImageUrl;

  stepIndex = 0;
  frequency = ONE_TIME;
  period = DEFAULT_PERIOD;
  selectedAmount;
  isOther = false;
  otherAmount;
  designationId;
  donorType = INDIVIDUAL;
  firstName = "";
  lastName = "";
  organizationName = "";
  email = "";
  sourceCode;

  designations = [];
  currentDonor;
  loadError;
  isLoading = true;
  isSubmitting = false;
  submitError;
  errors = {};
  result;
  // Campaign chosen via ?campaign= (e.g. from a dashboard card); falls back to the configured campaign.
  urlCampaign;
  // Campaign picked in the Campaign list on step 1 (header Donate / Get Involved arrive without one).
  pickedCampaign;
  openCampaigns = [];
  optionsCampaign;
  optionsDesignationNames;
  activeCampaign;
  campaignDescription;

  /** Seconds left before the signed-in donor is taken to the dashboard (null = no redirect). */
  redirectIn = null;

  connectedCallback() {
    this.selectedAmount = Number(this.defaultAmount) || null;
  }
  disconnectedCallback() {
    this.stopRedirect();
  }

  @wire(CurrentPageReference)
  setPageRef(pageRef) {
    const state = pageRef?.state || {};
    if (state.src) {
      this.sourceCode = String(state.src).slice(0, 80);
    }
    this.urlCampaign = state.campaign
      ? String(state.campaign).slice(0, 80)
      : undefined;
    this.pickedCampaign = undefined;
    this.useCampaign(this.urlCampaign || this.campaignName);
  }

  /** Load a campaign's options: its own causes, or the admin's list for the configured campaign. */
  useCampaign(name) {
    const isConfigured = name === this.campaignName;
    if (name !== this.optionsCampaign) {
      this.designationId = undefined;
    }
    this.optionsCampaign = name;
    this.optionsDesignationNames = isConfigured ? this.designationNames : "";
  }

  @wire(getCampaigns)
  wiredCampaigns({ data }) {
    if (data) {
      this.openCampaigns = data.map((c) => c.name);
    }
  }

  @wire(getOptions, {
    campaignName: "$optionsCampaign",
    designationNames: "$optionsDesignationNames"
  })
  wiredOptions({ data, error }) {
    if (data) {
      this.activeCampaign = data.campaignName;
      this.campaignDescription = data.campaignDescription;
      this.designations = data.designations || [];
      this.designationId = this.designationId || data.defaultDesignationId;
      this.currentDonor = data.currentDonor;
      this.loadError = undefined;
      this.isLoading = false;
    } else if (error) {
      this.loadError = reduceError(error);
      this.isLoading = false;
    }
  }

  // ------------------------------------------------------------ step state

  get steps() {
    return STEPS.map((s, i) => {
      const state =
        i < this.stepIndex ? "done" : i === this.stepIndex ? "active" : "todo";
      return {
        ...s,
        number: i + 1,
        className: `step step_${state}`,
        ariaCurrent: state === "active" ? "step" : null,
        showConnector: i < STEPS.length - 1,
        connectorClass:
          i < this.stepIndex ? "connector connector_done" : "connector"
      };
    });
  }
  get isChoose() {
    return this.stepIndex === 0;
  }
  get isDetails() {
    return this.stepIndex === 1;
  }
  get isReview() {
    return this.stepIndex === 2;
  }
  get isThanks() {
    return this.stepIndex === 3;
  }
  get showBack() {
    return this.stepIndex > 0 && this.stepIndex < 3;
  }
  get campaignLabel() {
    return this.activeCampaign || this.campaignName;
  }
  /** Admin-set review image, else a photo matching the campaign's theme. */
  get reviewImage() {
    if (this.reviewImageUrl) return this.reviewImageUrl;
    return campaignPhoto(this.campaignLabel, { width: 400, height: 300 }).url;
  }
  /** Campaign photo across the top of the card on the choose and details steps. */
  get showBanner() {
    return this.isChoose || this.isDetails;
  }
  get banner() {
    return campaignPhoto(this.campaignLabel, { width: 1280, height: 400 });
  }
  get subtitleText() {
    return (this.urlCampaign || this.pickedCampaign) && this.campaignDescription
      ? this.campaignDescription
      : this.subheading;
  }
  get showNext() {
    return this.stepIndex < 2;
  }
  get isOrganization() {
    return this.donorType === ORGANIZATION;
  }
  get canEditDonor() {
    return !this.isSignedIn;
  }

  // ------------------------------------------------------------ choose step

  get isOneTime() {
    return this.frequency === ONE_TIME;
  }
  get isRecurring() {
    return this.frequency === RECURRING;
  }
  get oneTimeClass() {
    return this.isOneTime ? "toggle-btn toggle-btn_on" : "toggle-btn";
  }
  get recurringClass() {
    return this.isRecurring ? "toggle-btn toggle-btn_on" : "toggle-btn";
  }
  get periodOptions() {
    return PERIODS.map((p) => {
      const selected = p.value === this.period;
      return {
        value: p.value,
        selected,
        className: selected ? "period-btn period-btn_on" : "period-btn"
      };
    });
  }
  get periodUnit() {
    return PERIODS.find((p) => p.value === this.period)?.unit || "month";
  }
  /** What Apex receives: "One-time", or the recurring period ("Weekly" | "Monthly" | "Yearly"). */
  get submitFrequency() {
    return this.isRecurring ? this.period : ONE_TIME;
  }
  get amountTiles() {
    return parseAmounts(this.amountOptions).map((value) => {
      const selected = !this.isOther && this.selectedAmount === value;
      return {
        value,
        key: `amt-${value}`,
        display: formatNumber(value),
        selected,
        className: selected ? "amount-tile amount-tile_on" : "amount-tile"
      };
    });
  }
  get otherClass() {
    return this.isOther
      ? "amount-tile amount-tile_other amount-tile_on"
      : "amount-tile amount-tile_other";
  }
  get amount() {
    return this.isOther ? Number(this.otherAmount) : this.selectedAmount;
  }
  get amountDisplay() {
    return `${this.currencyLabel} ${formatNumber(this.amount)}`;
  }
  get frequencyDisplay() {
    return this.isRecurring ? `Recurring (${this.period})` : "One-time";
  }
  get recurringHint() {
    return `${this.currencyLabel} ${formatNumber(this.amount || 0)} will be given every ${this.periodUnit}. You can stop anytime.`;
  }
  get designationOptions() {
    return this.designations.map((d) => ({
      ...d,
      selected: d.value === this.designationId
    }));
  }
  get designationName() {
    const d = this.designations.find((x) => x.value === this.designationId);
    return d ? d.label : "";
  }
  // Program the chosen designation funds (D-21); empty when it has none.
  get designationProgram() {
    const d = this.designations.find((x) => x.value === this.designationId);
    return d?.program || "";
  }
  get otherMin() {
    return MIN_AMOUNT;
  }
  get otherMax() {
    return MAX_AMOUNT;
  }

  handleFrequency(event) {
    this.frequency = event.currentTarget.dataset.value;
  }
  handlePeriod(event) {
    this.period = event.currentTarget.dataset.value;
  }
  handleAmount(event) {
    this.isOther = false;
    this.selectedAmount = Number(event.currentTarget.dataset.value);
    this.clearError("amount");
  }
  handleOther() {
    this.isOther = true;
    // Focus the input once it renders.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() =>
      this.template.querySelector('[data-id="otherAmount"]')?.focus()
    );
  }
  handleOtherAmount(event) {
    this.otherAmount = event.target.value;
    this.clearError("amount");
  }
  /** The open campaigns, with the current one selected (kept even if it isn't in the list). */
  get campaignOptions() {
    const current = this.campaignLabel;
    const names = this.openCampaigns.includes(current)
      ? this.openCampaigns
      : [current, ...this.openCampaigns];
    return names.map((n) => ({ value: n, label: n, selected: n === current }));
  }
  get showCampaignPicker() {
    return this.openCampaigns.length > 0;
  }
  handleCampaign(event) {
    const name = event.target.value;
    if (!name || name === this.campaignLabel) return;
    this.pickedCampaign = name;
    this.useCampaign(name);
    this.clearError("designation");
  }

  handleDesignation(event) {
    this.designationId = event.target.value;
    this.clearError("designation");
  }

  // ------------------------------------------------------------ details step

  get isIndividual() {
    return this.donorType === INDIVIDUAL;
  }
  get individualClass() {
    return this.isIndividual ? "toggle-btn toggle-btn_on" : "toggle-btn";
  }
  get organizationClass() {
    return !this.isIndividual ? "toggle-btn toggle-btn_on" : "toggle-btn";
  }
  get isSignedIn() {
    return !!this.currentDonor;
  }
  get donorDisplayName() {
    if (this.currentDonor) {
      return this.currentDonor.name;
    }
    return this.isIndividual
      ? `${this.firstName} ${this.lastName}`.trim()
      : this.organizationName;
  }
  get donorDisplayEmail() {
    return this.currentDonor ? this.currentDonor.email : this.email;
  }

  handleDonorType(event) {
    this.donorType = event.currentTarget.dataset.value;
    this.errors = {};
  }
  handleInput(event) {
    const field = event.target.dataset.field;
    this[field] = event.target.value;
    this.clearError(field);
  }

  // ------------------------------------------------------------ validation

  get amountError() {
    return this.errors.amount;
  }
  get designationError() {
    return this.errors.designation;
  }
  get firstNameError() {
    return this.errors.firstName;
  }
  get lastNameError() {
    return this.errors.lastName;
  }
  get organizationNameError() {
    return this.errors.organizationName;
  }
  get emailError() {
    return this.errors.email;
  }

  clearError(field) {
    if (this.errors[field]) {
      const next = { ...this.errors };
      delete next[field];
      this.errors = next;
    }
  }

  validateChoose() {
    const errors = {};
    const amt = this.amount;
    if (!amt || Number.isNaN(amt) || amt < MIN_AMOUNT || amt > MAX_AMOUNT) {
      errors.amount = `Please enter an amount between ${formatNumber(MIN_AMOUNT)} and ${formatNumber(MAX_AMOUNT)}.`;
    }
    if (!this.designationId) {
      errors.designation = "Please choose what you would like to support.";
    }
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  validateDetails() {
    if (this.isSignedIn) {
      return true;
    }
    const errors = {};
    if (this.isIndividual) {
      if (!this.firstName.trim())
        errors.firstName = "Please enter your first name.";
      if (!this.lastName.trim())
        errors.lastName = "Please enter your last name.";
    } else if (!this.organizationName.trim()) {
      errors.organizationName = "Please enter the organization name.";
    }
    if (!EMAIL_RE.test(this.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  // ------------------------------------------------------------ navigation

  handleNext() {
    const valid = this.isChoose
      ? this.validateChoose()
      : this.validateDetails();
    if (valid) {
      this.goTo(this.stepIndex + 1);
    }
  }
  handleBack() {
    this.errors = {};
    this.submitError = undefined;
    this.goTo(this.stepIndex - 1);
  }
  handleEdit(event) {
    this.goTo(Number(event.currentTarget.dataset.step));
  }
  goTo(index) {
    this.stepIndex = Math.max(0, Math.min(index, STEPS.length - 1));
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    requestAnimationFrame(() => {
      const top = this.template.querySelector(".journey");
      if (top && typeof top.scrollIntoView === "function") {
        top.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async handleSubmit() {
    if (this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;
    this.submitError = undefined;
    const request = {
      campaignName: this.activeCampaign || this.campaignName,
      frequency: this.submitFrequency,
      amount: this.amount,
      designationId: this.designationId,
      donorType: this.isSignedIn ? null : this.donorType,
      firstName: this.isIndividual ? this.firstName.trim() : null,
      lastName: this.isIndividual ? this.lastName.trim() : null,
      organizationName: this.isIndividual ? null : this.organizationName.trim(),
      email: this.isSignedIn ? null : this.email.trim(),
      sourceCode: this.sourceCode || null
    };
    try {
      this.result = await submitDonation({
        requestJson: JSON.stringify(request)
      });
      // Totals, campaign progress and recurring gifts elsewhere on the site reload with this gift.
      markGiftsChanged();
      this.goTo(3);
      // Guests have no dashboard; signed-in donors see their updated giving there.
      if (this.isSignedIn) this.startRedirect();
    } catch (error) {
      this.submitError = reduceError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  startRedirect() {
    this.stopRedirect();
    this.redirectIn = REDIRECT_SECONDS;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._redirectTimer = setInterval(() => {
      this.redirectIn -= 1;
      if (this.redirectIn <= 0) {
        this.stopRedirect();
        window.location.assign(this.dashboardHref);
      }
    }, 1000);
  }
  stopRedirect() {
    clearInterval(this._redirectTimer);
    this._redirectTimer = null;
    this.redirectIn = null;
  }
  get showRedirect() {
    return this.redirectIn !== null;
  }
  get redirectNote() {
    const n = this.redirectIn;
    return `Taking you to your dashboard in ${n} second${n === 1 ? "" : "s"}…`;
  }
  get dashboardHref() {
    return `${basePath || ""}/dashboard`;
  }

  handleRestart() {
    this.stopRedirect();
    this.result = undefined;
    this.isOther = false;
    this.otherAmount = undefined;
    this.selectedAmount = Number(this.defaultAmount) || null;
    this.frequency = ONE_TIME;
    this.period = DEFAULT_PERIOD;
    this.goTo(0);
  }

  get resultAmountDisplay() {
    return this.result
      ? `${this.currencyLabel} ${formatNumber(this.result.amount)}`
      : "";
  }
  get resultFrequencyNote() {
    const p = PERIODS.find((x) => x.value === this.result?.frequency);
    return p ? `every ${p.unit}` : "";
  }
  get submitLabel() {
    return this.isSubmitting ? "Submitting…" : "Submit Donation Details";
  }
}

export function parseAmounts(csv) {
  return String(csv || "")
    .split(",")
    .map((v) => Number(String(v).trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
}

export function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)
    : "";
}

function reduceError(error) {
  if (!error) return "Something went wrong. Please try again.";
  if (Array.isArray(error.body))
    return error.body.map((e) => e.message).join(", ");
  return (
    error.body?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}
