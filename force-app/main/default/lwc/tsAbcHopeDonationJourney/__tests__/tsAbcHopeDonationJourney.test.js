import { createElement } from "lwc";
import DonationJourney, {
  parseAmounts,
  formatNumber
} from "c/tsAbcHopeDonationJourney";
import getOptions from "@salesforce/apex/TSAbcHopeDonationIntakeController.getOptions";
import submitDonation from "@salesforce/apex/TSAbcHopeDonationIntakeController.submitDonation";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";
import { CurrentPageReference } from "lightning/navigation";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getOptions",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.submitDonation",
  () => ({ default: jest.fn() }),
  {
    virtual: true
  }
);

const OPTIONS = {
  campaignName: "Christmas Giving 2026",
  designations: [
    { label: "School Supplies", value: "a01" },
    { label: "Learning Kits", value: "a02" }
  ],
  defaultDesignationId: "a01",
  currentDonor: null
};

const flush = () => Promise.resolve().then(() => Promise.resolve());

function mount() {
  const el = createElement("c-ts-abc-hope-donation-journey", {
    is: DonationJourney
  });
  document.body.appendChild(el);
  return el;
}
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const $$ = (el, sel) => [...el.shadowRoot.querySelectorAll(sel)];
const click = (node) => node.dispatchEvent(new CustomEvent("click"));
function type(node, value) {
  node.value = value;
  node.dispatchEvent(new CustomEvent("input"));
}

async function goToDetails(el) {
  getOptions.emit(OPTIONS);
  await flush();
  click($(el, '[data-id="next"]'));
  await flush();
}

describe("c-ts-abc-hope-donation-journey", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("renders amount tiles with the default amount selected", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    const tiles = $$(el, ".amount-tile:not(.amount-tile_other)");
    expect(
      tiles.map((t) => t.querySelector(".amount-value").textContent)
    ).toEqual(["300", "500", "1,000"]);
    expect($(el, ".amount-tile_on .amount-value").textContent).toBe("1,000");
    expect($(el, "select").value).toBe("a01");
  });

  it("shows a load error when options fail", async () => {
    const el = mount();
    getOptions.error({
      message: "This campaign is not accepting donations right now."
    });
    await flush();
    expect($(el, ".alert_error")).not.toBeNull();
  });

  it("blocks an Other amount below the minimum", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    click($(el, ".amount-tile_other"));
    await flush();
    type($(el, '[data-id="otherAmount"]'), "50");
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, ".field-error").textContent).toContain("between 100");
    expect($(el, ".step_active .step-label").textContent).toBe(
      "Choose Donation"
    );
  });

  it("Recurring shows Weekly / Monthly / Yearly, Monthly first", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    expect($(el, '[data-id="periods"]')).toBeNull();
    const recurring = $$(el, ".toggle-btn")[1];
    expect(recurring.textContent.trim()).toBe("Recurring");
    click(recurring);
    await flush();
    expect($$(el, ".period-btn").map((b) => b.textContent.trim())).toEqual([
      "Weekly",
      "Monthly",
      "Yearly"
    ]);
    expect($(el, ".period-btn_on").textContent.trim()).toBe("Monthly");
    expect($(el, ".hint").textContent).toContain("every month");
    // Guests have no My Giving page to manage the gift.
    expect($(el, ".hint").textContent).toContain(
      "sign in or contact the ABC Hope team"
    );

    click($$(el, ".period-btn")[2]);
    await flush();
    expect($(el, ".period-btn_on").textContent.trim()).toBe("Yearly");
    expect($(el, ".hint").textContent).toContain("every year");
  });

  it("shows the campaign photo banner on the choose and details steps", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    const img = $(el, '[data-id="banner"] img');
    expect(img.getAttribute("src")).toContain("images.unsplash.com");
    expect($(el, ".banner-credit").textContent).toContain("Unsplash");
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, '[data-id="banner"]')).not.toBeNull();
  });

  it("submits a weekly recurring gift with frequency Weekly", async () => {
    submitDonation.mockResolvedValue({
      reference: "XMAS-2",
      amount: 300,
      frequency: "Weekly",
      designationName: "School Supplies"
    });
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    click($$(el, ".toggle-btn")[1]);
    await flush();
    click($$(el, ".period-btn")[0]);
    click($$(el, ".amount-tile")[0]);
    await flush();
    click($(el, '[data-id="next"]'));
    await flush();
    type($(el, '[data-field="firstName"]'), "Ann");
    type($(el, '[data-field="lastName"]'), "Demo");
    type($(el, '[data-field="email"]'), "ann@example.com");
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, ".review-grid dd").textContent).toContain(
      "Recurring (Weekly)"
    );
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();

    const sent = JSON.parse(submitDonation.mock.calls[0][0].requestJson);
    expect(sent).toMatchObject({ frequency: "Weekly", amount: 300 });
    expect($(el, ".thanks-amount").textContent).toContain("every week");
  });

  it("shows the program the chosen designation funds", async () => {
    const el = mount();
    getOptions.emit({
      ...OPTIONS,
      designations: [
        { label: "School Supplies", value: "a01", program: "Education Access" },
        { label: "Where Most Needed", value: "a03" }
      ]
    });
    await flush();
    expect($(el, '[data-id="program-hint"]').textContent).toContain(
      "Funds our Education Access program."
    );

    const select = $(el, '[data-id="designation"]');
    select.value = "a03";
    select.dispatchEvent(new CustomEvent("change"));
    await flush();
    expect($(el, '[data-id="program-hint"]')).toBeNull();
  });

  it("validates details and switches fields for organizations", async () => {
    const el = mount();
    await goToDetails(el);
    click($(el, '[data-id="next"]'));
    await flush();
    expect($$(el, ".field-error").length).toBe(3);

    click($$(el, ".toggle-btn")[1]); // Organization
    await flush();
    expect($(el, '[data-field="organizationName"]')).not.toBeNull();
    expect($(el, '[data-field="firstName"]')).toBeNull();
  });

  it("submits a one-time gift and shows the thank-you step", async () => {
    submitDonation.mockResolvedValue({
      reference: "XMAS-1",
      amount: 1000,
      frequency: "One-time",
      designationName: "School Supplies"
    });
    const el = mount();
    CurrentPageReference.emit({ state: { src: "XMAS26-EMAIL" } });
    await goToDetails(el);
    type($(el, '[data-field="firstName"]'), "Ann");
    type($(el, '[data-field="lastName"]'), "Demo");
    type($(el, '[data-field="email"]'), "ann@example.com");
    click($(el, '[data-id="next"]'));
    await flush();

    expect($(el, ".review-value").textContent).toBe("School Supplies");
    expect($(el, ".notice_purple").textContent).toContain(
      "Payment simulation only"
    );
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();

    const sent = JSON.parse(submitDonation.mock.calls[0][0].requestJson);
    expect(sent).toMatchObject({
      frequency: "One-time",
      amount: 1000,
      designationId: "a01",
      donorType: "Individual",
      firstName: "Ann",
      email: "ann@example.com",
      sourceCode: "XMAS26-EMAIL"
    });
    expect($(el, ".thanks .title").textContent).toBe(
      "Your details have been received"
    );
    expect($(el, ".thanks-amount").textContent).toContain("USD 1,000");
    expect($(el, '[data-id="manage-note"]')).toBeNull(); // one-time gift
    // Guests have no dashboard: no redirect.
    expect($(el, '[data-id="redirect"]')).toBeNull();
    // Tells the rest of the site to reload totals and campaign progress.
    expect(sessionStorage.getItem("abchope:giftsChangedAt")).not.toBeNull();
  });

  it("shows the server error and stays on review when submit fails", async () => {
    submitDonation.mockRejectedValue({
      body: { message: "Please enter a valid email address." }
    });
    const el = mount();
    await goToDetails(el);
    type($(el, '[data-field="firstName"]'), "Ann");
    type($(el, '[data-field="lastName"]'), "Demo");
    type($(el, '[data-field="email"]'), "ann@example.com");
    click($(el, '[data-id="next"]'));
    await flush();
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();
    expect($(el, ".alert_error").textContent).toBe(
      "Please enter a valid email address."
    );
    expect($(el, ".step_active .step-label").textContent).toBe(
      "Review & Submit"
    );
  });

  it("defaults to Non specified for several causes and splits the gift across them", async () => {
    submitDonation.mockResolvedValue({
      reference: "XMAS-3",
      amount: 1000,
      frequency: "One-time",
      designationName: "Non specified",
      splitSummary: "School Supplies 50%, Learning Kits 50%"
    });
    const el = mount();
    getOptions.emit({
      ...OPTIONS,
      split: [
        { name: "School Supplies", percent: 50 },
        { name: "Learning Kits", percent: 50 }
      ],
      currentDonor: { name: "Maya Grande", email: "maya@email.com" }
    });
    await flush();
    // Several causes: Non specified comes first and is chosen by default (D-53).
    const options = $$(el, '[data-id="designation"] option');
    expect(options.map((o) => o.textContent.trim())).toEqual([
      "Non specified",
      "School Supplies",
      "Learning Kits"
    ]);
    expect(options[0].selected).toBe(true);
    expect($(el, '[data-id="split-hint"]').textContent).toBe(
      "Split across School Supplies 50%, Learning Kits 50%."
    );
    click($(el, '[data-id="next"]'));
    await flush();
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, ".review-value").textContent).toBe("Non specified");
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();
    const sent = JSON.parse(submitDonation.mock.calls[0][0].requestJson);
    expect(sent).toMatchObject({ designationId: null, nonSpecified: true });
    expect($(el, '[data-id="result-split"]').textContent).toContain(
      "School Supplies 50%, Learning Kits 50%"
    );
  });
  it("a donor can still pick one cause instead of Non specified", async () => {
    const el = mount();
    getOptions.emit({
      ...OPTIONS,
      split: [
        { name: "School Supplies", percent: 50 },
        { name: "Learning Kits", percent: 50 }
      ]
    });
    await flush();
    const select = $(el, '[data-id="designation"]');
    select.value = "a02";
    select.dispatchEvent(new CustomEvent("change"));
    await flush();
    expect($(el, '[data-id="split-hint"]')).toBeNull();
  });
  it("does not offer Non specified when the campaign has one cause", async () => {
    const el = mount();
    getOptions.emit({ ...OPTIONS, split: [] });
    await flush();
    expect(
      $$(el, '[data-id="designation"] option').map((o) => o.textContent.trim())
    ).not.toContain("Non specified");
    // One cause: the campaign's own cause stays the default.
    expect($(el, '[data-id="designation"] option').selected).toBe(true);
    expect($(el, '[data-id="designation"] option').value).toBe("a01");
  });
  it("uses the signed-in donor and skips the details form", async () => {
    const el = mount();
    getOptions.emit({
      ...OPTIONS,
      currentDonor: { name: "Maya Grande", email: "maya@email.com" }
    });
    await flush();
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, ".welcome-name").textContent).toBe("Maya Grande");
    expect($(el, '[data-field="email"]')).toBeNull();
  });
  it("takes a signed-in donor to the dashboard 5 seconds after donating", async () => {
    submitDonation.mockResolvedValue({
      reference: "XMAS-2",
      amount: 1000,
      frequency: "One-time",
      designationName: "School Supplies"
    });
    const assign = jest.fn();
    const realLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...realLocation, assign },
      configurable: true
    });
    try {
      const el = mount();
      getOptions.emit({
        ...OPTIONS,
        currentDonor: { name: "Maya Grande", email: "maya@email.com" }
      });
      await flush();
      click($(el, '[data-id="next"]'));
      await flush();
      click($(el, '[data-id="next"]'));
      await flush();
      jest.useFakeTimers();
      click($(el, '[data-id="submit"]'));
      await flush();
      await flush();
      expect($(el, '[data-id="redirect"]').textContent).toContain(
        "dashboard in 5 seconds"
      );
      jest.advanceTimersByTime(4000);
      await flush();
      expect($(el, '[data-id="redirect"]').textContent).toContain(
        "in 1 second…"
      );
      expect(assign).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);
      expect(assign).toHaveBeenCalledWith("/dashboard");
    } finally {
      jest.useRealTimers();
      Object.defineProperty(window, "location", {
        value: realLocation,
        configurable: true
      });
    }
  });

  it("lets the donor pick the campaign on step 1", async () => {
    const el = mount();
    // Header Donate / Get Involved: /donate with no ?campaign=.
    CurrentPageReference.emit({ state: {} });
    getOptions.emit(OPTIONS);
    getCampaigns.emit([
      { name: "Christmas Toy Drive 2026" },
      { name: "Christmas Giving 2026" },
      { name: "Clean Water for Rural Schools" }
    ]);
    await flush();
    const select = $(el, '[data-id="campaign"]');
    expect([...select.options].map((o) => o.value)).toEqual([
      "Christmas Toy Drive 2026",
      "Christmas Giving 2026",
      "Clean Water for Rural Schools"
    ]);
    expect(select.value).toBe("Christmas Giving 2026");
    expect(getOptions.getLastConfig()).toEqual({
      campaignName: "Christmas Giving 2026",
      designationNames: "School Supplies,Learning Kits,Where Most Needed"
    });

    select.value = "Christmas Toy Drive 2026";
    select.dispatchEvent(new CustomEvent("change"));
    await flush();
    // Another campaign loads its own causes (no admin list).
    expect(getOptions.getLastConfig()).toEqual({
      campaignName: "Christmas Toy Drive 2026",
      designationNames: ""
    });
    getOptions.emit({
      ...OPTIONS,
      campaignName: "Christmas Toy Drive 2026",
      campaignDescription: "A Christmas present for every child.",
      designations: [
        { label: "Toys & Gifts", value: "t1" },
        { label: "Warm Clothes", value: "t2" }
      ],
      defaultDesignationId: "t1"
    });
    await flush();
    expect($(el, ".eyebrow").textContent).toBe("Christmas Toy Drive 2026");
    expect($(el, ".subtitle").textContent).toBe(
      "A Christmas present for every child."
    );
    expect($(el, '[data-id="designation"]').value).toBe("t1");
  });

  it("hides the campaign picker until open campaigns load", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    expect($(el, '[data-id="campaign"]')).toBeNull();
  });

  it("donates to the campaign chosen in the URL", async () => {
    submitDonation.mockResolvedValue({
      reference: "CW-1",
      amount: 500,
      frequency: "One-time",
      designationName: "Clean Water"
    });
    const el = mount();
    CurrentPageReference.emit({
      state: { campaign: "Clean Water for Rural Schools" }
    });
    getOptions.emit({
      ...OPTIONS,
      campaignName: "Clean Water for Rural Schools",
      campaignDescription: "Water filters for rural schools.",
      designations: [{ label: "Clean Water", value: "cw1" }],
      defaultDesignationId: "cw1"
    });
    await flush();
    expect($(el, ".eyebrow").textContent).toBe("Clean Water for Rural Schools");
    expect($(el, ".subtitle").textContent).toBe(
      "Water filters for rural schools."
    );
    click($(el, '[data-id="next"]'));
    await flush();
    type($(el, '[data-field="firstName"]'), "Ann");
    type($(el, '[data-field="lastName"]'), "Demo");
    type($(el, '[data-field="email"]'), "ann@example.com");
    click($(el, '[data-id="next"]'));
    await flush();
    expect($(el, ".review-campaign").textContent).toBe(
      "Clean Water for Rural Schools"
    );
    // Clean Water gets the water photo on review and thank-you (no SVG placeholder).
    expect($(el, ".review-img").src).toContain("photo-1740741705746");
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();
    expect($(el, ".thanks-img").src).toContain("photo-1740741705746");
    const sent = JSON.parse(submitDonation.mock.calls[0][0].requestJson);
    expect(sent.campaignName).toBe("Clean Water for Rural Schools");
    expect(sent.designationId).toBe("cw1");
  });
});

describe("helpers", () => {
  it("parses amount options", () => {
    expect(parseAmounts("300, 500,abc,,1000")).toEqual([300, 500, 1000]);
  });
  it("formats numbers", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber("x")).toBe("");
  });
});
