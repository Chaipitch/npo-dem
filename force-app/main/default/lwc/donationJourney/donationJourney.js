import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import getOptions from "@salesforce/apex/DonationIntakeController.getOptions";
import submitDonation from "@salesforce/apex/DonationIntakeController.submitDonation";

const STEPS = [
  { key: "choose", label: "Choose Donation" },
  { key: "details", label: "Your Details" },
  { key: "review", label: "Review & Submit" },
  { key: "thanks", label: "Thank You" }
];
const ONE_TIME = "One-time";
const MONTHLY = "Monthly";
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
  @api currencyLabel = "THB";
  @api heading = "Choose your donation";
  @api subheading =
    "Your support helps provide education opportunities for children in need.";
  @api reviewImageUrl;

  stepIndex = 0;
  frequency = ONE_TIME;
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
  optionsCampaign;
  optionsDesignationNames;
  activeCampaign;
  campaignDescription;

  connectedCallback() {
    this.selectedAmount = Number(this.defaultAmount) || null;
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
    const useUrl = this.urlCampaign && this.urlCampaign !== this.campaignName;
    // A different campaign uses its own designations (server picks them); the configured
    // campaign keeps the admin's designation list.
    this.optionsCampaign = useUrl ? this.urlCampaign : this.campaignName;
    this.optionsDesignationNames = useUrl ? "" : this.designationNames;
    if (useUrl) {
      this.designationId = undefined;
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
  get subtitleText() {
    return this.urlCampaign && this.campaignDescription
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
  get isMonthly() {
    return this.frequency === MONTHLY;
  }
  get oneTimeClass() {
    return this.isOneTime ? "toggle-btn toggle-btn_on" : "toggle-btn";
  }
  get monthlyClass() {
    return this.isMonthly ? "toggle-btn toggle-btn_on" : "toggle-btn";
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
    return this.isMonthly ? "Monthly" : "One-time";
  }
  get monthlyHint() {
    return `${this.currencyLabel} ${formatNumber(this.amount || 0)} will be given every month. You can stop anytime.`;
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
  get otherMin() {
    return MIN_AMOUNT;
  }
  get otherMax() {
    return MAX_AMOUNT;
  }

  handleFrequency(event) {
    this.frequency = event.currentTarget.dataset.value;
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
      frequency: this.frequency,
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
      this.goTo(3);
    } catch (error) {
      this.submitError = reduceError(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  handleRestart() {
    this.result = undefined;
    this.isOther = false;
    this.otherAmount = undefined;
    this.selectedAmount = Number(this.defaultAmount) || null;
    this.frequency = ONE_TIME;
    this.goTo(0);
  }

  get resultAmountDisplay() {
    return this.result
      ? `${this.currencyLabel} ${formatNumber(this.result.amount)}`
      : "";
  }
  get resultFrequencyNote() {
    return this.result && this.result.frequency === MONTHLY
      ? "every month"
      : "";
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
