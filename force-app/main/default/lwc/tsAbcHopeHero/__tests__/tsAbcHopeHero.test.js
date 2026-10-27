import { createElement } from "lwc";
import AbcHopeHero from "c/tsAbcHopeHero";
import getCampaigns from "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns";
import { CurrentPageReference } from "lightning/navigation";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getCampaigns",
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
jest.mock(
  "@salesforce/user/isGuest",
  () => ({ __esModule: true, default: true }),
  {
    virtual: true
  }
);

const CAMPAIGNS = [
  { id: "701x", name: "Christmas Giving 2026", description: "Featured" },
  {
    id: "701a",
    name: "Clean Water for Rural Schools",
    description: "Safe drinking water for 40 schools.",
    daysLeft: 53
  },
  {
    id: "701b",
    name: "Green Communities Tree Planting",
    description: "Plant trees."
  }
];

const flush = () => Promise.resolve().then(() => Promise.resolve());
const $ = (el, s) => el.shadowRoot.querySelector(s);
const $$ = (el, s) => [...el.shadowRoot.querySelectorAll(s)];
const active = (el) =>
  $(el, ".slide_active .headline").textContent.replace(/\s+/g, " ").trim();
const click = (n) => n.dispatchEvent(new CustomEvent("click"));

describe("c-ts-abc-hope-hero", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.useRealTimers();
  });

  async function mount() {
    const el = createElement("c-ts-abc-hope-hero", { is: AbcHopeHero });
    document.body.appendChild(el);
    CurrentPageReference.emit({ state: { src: "XMAS26-EMAIL" } });
    getCampaigns.emit(CAMPAIGNS);
    await flush();
    return el;
  }

  it("shows the featured slide first, then the other open campaigns", async () => {
    const el = await mount();
    expect($$(el, '[data-id="slide"]').length).toBe(3);
    expect(active(el)).toBe("Make ChristmasBrighter");
    expect($(el, ".slide_active .eyebrow").textContent).toBe(
      "Christmas Giving 2026"
    );
    const donate = $$(el, '[data-id="donate"]');
    expect(donate[0].getAttribute("href")).toBe("/donate?src=XMAS26-EMAIL");
    expect(donate[1].getAttribute("href")).toBe(
      "/donate?campaign=Clean%20Water%20for%20Rural%20Schools&src=XMAS26-EMAIL"
    );
  });

  it("advances every 10 seconds and wraps around", async () => {
    const el = await mount();
    jest.advanceTimersByTime(10000);
    await flush();
    expect(active(el)).toBe("Clean Water for Rural Schools");
    expect($(el, ".slide_active .eyebrow").textContent).toBe("53 days left");
    jest.advanceTimersByTime(20000);
    await flush();
    expect(active(el)).toBe("Make ChristmasBrighter");
  });

  it("arrows and dots move it by hand", async () => {
    const el = await mount();
    click($(el, '[data-id="prev"]'));
    await flush();
    expect(active(el)).toBe("Green Communities Tree Planting");
    click($(el, '[data-id="next"]'));
    await flush();
    expect(active(el)).toBe("Make ChristmasBrighter");
    click($$(el, ".dot")[1]);
    await flush();
    expect(active(el)).toBe("Clean Water for Rural Schools");
  });

  it("pause stops the slideshow; hover pauses it too", async () => {
    const el = await mount();
    click($(el, '[data-id="pause"]'));
    await flush();
    jest.advanceTimersByTime(30000);
    await flush();
    expect(active(el)).toBe("Make ChristmasBrighter");
    click($(el, '[data-id="pause"]'));
    $(el, ".hero").dispatchEvent(new CustomEvent("mouseenter"));
    jest.advanceTimersByTime(30000);
    await flush();
    expect(active(el)).toBe("Make ChristmasBrighter");
    $(el, ".hero").dispatchEvent(new CustomEvent("mouseleave"));
    jest.advanceTimersByTime(10000);
    await flush();
    expect(active(el)).toBe("Clean Water for Rural Schools");
  });
});
