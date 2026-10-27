import { createElement } from "lwc";
import ProgramDetail, {
  deliveryLabel,
  formatNumber
} from "c/tsAbcHopeProgramDetail";
import getProgramDetail from "@salesforce/apex/TSAbcHopeDonationIntakeController.getProgramDetail";
import { CurrentPageReference } from "lightning/navigation";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getProgramDetail",
  () => {
    const { createApexTestWireAdapter } = require("@salesforce/sfdx-lwc-jest");
    return { default: createApexTestWireAdapter(jest.fn()) };
  },
  { virtual: true }
);
jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

const PROGRAM = {
  name: "Child Wellbeing",
  summary: "Christmas presents and warm clothes for children.",
  raised: 12534,
  donorCount: 2,
  peopleReached: 60,
  campaigns: ["Christmas Toy Drive 2026"],
  causes: ["Toys & Gifts", "Warm Clothes"],
  deliveries: [
    { benefit: "Toy parcel", quantity: 60, unit: "Items" },
    { benefit: "Winter clothing pack", quantity: 1, unit: "Items" }
  ]
};

const flush = () => Promise.resolve().then(() => Promise.resolve());
const $ = (el, s) => el.shadowRoot.querySelector(s);
const $$ = (el, s) => [...el.shadowRoot.querySelectorAll(s)];
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

function mount() {
  const el = createElement("c-ts-abc-hope-program-detail", {
    is: ProgramDetail
  });
  document.body.appendChild(el);
  return el;
}

describe("c-ts-abc-hope-program-detail", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows raised, people reached, deliveries and funding campaigns", async () => {
    const el = mount();
    CurrentPageReference.emit({ state: { name: "Child Wellbeing" } });
    getProgramDetail.emit(PROGRAM);
    await flush();
    expect(text($(el, '[data-id="title"]'))).toBe("Child Wellbeing");
    expect(text($(el, '[data-id="raised"]'))).toBe("USD 12,534");
    expect(text($(el, '[data-id="people"]'))).toBe("60");
    const tile = (li) =>
      [...li.querySelectorAll("span")].map((x) => x.textContent).join(" ");
    expect($$(el, '[data-id="delivery"]').map(tile)).toEqual([
      "60 toy parcels delivered",
      "1 winter clothing pack delivered"
    ]);
    expect($(el, '[data-id="campaign-donate"]').getAttribute("href")).toBe(
      "/donate?campaign=Christmas%20Toy%20Drive%202026"
    );
    expect($(el, '[data-id="donate"]').getAttribute("href")).toBe(
      "/donate?campaign=Christmas%20Toy%20Drive%202026"
    );
    expect($$(el, ".chip").map(text)).toEqual(["Toys & Gifts", "Warm Clothes"]);
    expect($(el, '[data-id="back"]').getAttribute("href")).toBe("/our-work");
    expect($(el, ".hero-img").src).toContain("photo-1634038036367");
  });

  it("without an open campaign the button gives where most needed", async () => {
    const el = mount();
    CurrentPageReference.emit({ state: { name: "Food Access" } });
    getProgramDetail.emit({ ...PROGRAM, campaigns: [], raised: 0 });
    await flush();
    expect($(el, '[data-id="donate"]').getAttribute("href")).toBe("/donate");
    expect($(el, '[data-id="campaign"]')).toBeNull();
    expect(text($(el, '[data-id="raised"]'))).toBe("USD 0");
  });

  it("says when a program is not found", async () => {
    const el = mount();
    CurrentPageReference.emit({ state: { name: "Nope" } });
    getProgramDetail.emit(null);
    await flush();
    expect($(el, '[data-id="not-found"]')).not.toBeNull();
  });
});

describe("helpers", () => {
  it("labels deliveries in the plural unless one", () => {
    expect(deliveryLabel({ benefit: "Holiday meal", quantity: 396 })).toBe(
      "holiday meals delivered"
    );
    expect(deliveryLabel({ benefit: "Tree sapling", quantity: 1 })).toBe(
      "tree sapling delivered"
    );
    expect(deliveryLabel({ benefit: "Classes", quantity: 4 })).toBe(
      "classes delivered"
    );
    expect(
      deliveryLabel({ benefit: "Financial literacy classes", quantity: 1 })
    ).toBe("financial literacy class delivered");
    expect(deliveryLabel({ benefit: "Grocery delivery", quantity: 25 })).toBe(
      "grocery deliveries"
    );
    expect(deliveryLabel({ benefit: "Grocery delivery", quantity: 1 })).toBe(
      "grocery delivery"
    );
  });
  it("formats numbers", () => {
    expect(formatNumber(1240)).toBe("1,240");
    expect(formatNumber("x")).toBe("");
  });
});
