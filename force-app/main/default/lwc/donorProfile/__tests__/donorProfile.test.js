import { createElement } from "lwc";
import DonorProfile, { toDraft } from "c/donorProfile";
import getProfile from "@salesforce/apex/DonorPortalController.getProfile";

jest.mock(
  "@salesforce/apex/DonorPortalController.getProfile",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/DonorPortalController.saveProfile",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

// Lets the resolved Apex mock and the re-render settle (several microtask hops).
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

describe("c-donor-profile", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows empty fields as blank, not 'undefined'", async () => {
    // Apex omits empty fields from its response.
    getProfile.mockResolvedValue({
      firstName: "Maya",
      lastName: "Grande",
      email: "maya@email.com",
      donorSince: "2023",
      emailOptOut: false
    });
    const el = createElement("c-donor-profile", { is: DonorProfile });
    document.body.appendChild(el);
    await flush();

    for (const field of ["phone", "street", "city", "country"]) {
      const input = el.shadowRoot.querySelector(`[data-field="${field}"]`);
      expect(input.value).toBe("");
    }
    expect(el.shadowRoot.querySelector('[data-field="firstName"]').value).toBe(
      "Maya"
    );
    expect(el.shadowRoot.textContent).toContain("Donor since 2023");
    expect(el.shadowRoot.textContent).not.toContain("undefined");
  });

  it("toDraft fills missing text fields and keeps the rest", () => {
    expect(toDraft({ firstName: "A", emailOptOut: true })).toEqual({
      firstName: "A",
      lastName: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      country: "",
      emailOptOut: true
    });
  });
});
