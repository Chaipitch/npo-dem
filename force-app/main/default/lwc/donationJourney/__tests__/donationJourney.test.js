import { createElement } from "lwc";
import DonationJourney, { parseAmounts, formatNumber } from "c/donationJourney";
import getOptions from "@salesforce/apex/DonationIntakeController.getOptions";
import submitDonation from "@salesforce/apex/DonationIntakeController.submitDonation";
import { CurrentPageReference } from "lightning/navigation";

jest.mock(
  "@salesforce/apex/DonationIntakeController.getOptions",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/DonationIntakeController.submitDonation",
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
  const el = createElement("c-donation-journey", { is: DonationJourney });
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

describe("c-donation-journey", () => {
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

  it("shows monthly hint when Monthly is selected", async () => {
    const el = mount();
    getOptions.emit(OPTIONS);
    await flush();
    click($$(el, ".toggle-btn")[1]);
    await flush();
    expect($(el, ".hint").textContent).toContain("every month");
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
    expect($(el, ".thanks-amount").textContent).toContain("THB 1,000");
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
    click($(el, '[data-id="submit"]'));
    await flush();
    await flush();
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
