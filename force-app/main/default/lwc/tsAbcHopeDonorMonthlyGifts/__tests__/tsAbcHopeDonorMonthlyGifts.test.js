import { createElement } from "lwc";
import DonorMonthlyGifts, { formatDate } from "c/tsAbcHopeDonorMonthlyGifts";
import getMonthlyGifts from "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts";
import manageMonthlyGift from "@salesforce/apex/TSAbcHopeDonorPortalController.manageMonthlyGift";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.getMonthlyGifts",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/TSAbcHopeDonorPortalController.manageMonthlyGift",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const ACTIVE = {
  id: "gc1",
  amount: 500,
  designation: "School Supplies",
  program: "Education Access",
  campaignName: "Christmas Giving 2026",
  isPaused: false,
  nextGiftDate: "2026-11-01"
};
const PAUSED = {
  ...ACTIVE,
  isPaused: true,
  pausedFrom: "2026-10-23",
  pausedUntil: "2026-12-22",
  nextGiftDate: "2027-01-01"
};

// Lets resolved Apex mocks and the re-render settle (several microtask hops).
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

async function mount(gifts) {
  getMonthlyGifts.mockResolvedValue(gifts);
  const el = createElement("c-ts-abc-hope-donor-monthly-gifts", {
    is: DonorMonthlyGifts
  });
  document.body.appendChild(el);
  await flush();
  return el;
}
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const click = (el, action) =>
  $(el, `[data-action="${action}"]`).dispatchEvent(new CustomEvent("click"));
const text = (el, sel) => $(el, sel).textContent.replace(/\s+/g, " ").trim();

describe("c-ts-abc-hope-donor-monthly-gifts", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    jest.clearAllMocks();
  });

  it("lists a recurring gift with its type, program, status and next gift", async () => {
    const el = await mount([ACTIVE]);
    expect(text(el, '[data-id="type"]')).toBe("Recurring (Monthly)");
    expect(text(el, ".gift-amount")).toBe("USD 500 / month");
    expect(text(el, ".gift-meta")).toBe(
      "School Supplies · Education Access program · Christmas Giving 2026"
    );
    expect(text(el, '[data-id="status"]')).toBe("Active");
    expect(text(el, ".gift-next")).toBe("Next gift 1 Nov 2026");
    expect($(el, '[data-action="resume"]')).toBeNull();
  });

  it("explains that changing the schedule means a new gift", async () => {
    const el = await mount([{ ...ACTIVE, period: "Weekly" }]);
    expect(text(el, '[data-id="schedule-note"]')).toBe(
      "Want a different schedule (weekly, monthly or yearly)? Cancel the gift and start a new one."
    );
    click(el, "open-amount");
    await flush();
    expect(text(el, ".panel .hint")).toContain("The gift stays weekly.");
  });

  it("shows the schedule period after the amount", async () => {
    const el = await mount([{ ...ACTIVE, amount: 300, period: "Weekly" }]);
    expect(text(el, '[data-id="type"]')).toBe("Recurring (Weekly)");
    expect(text(el, ".gift-amount")).toBe("USD 300 / week");
  });

  it("shows an empty state with a link to give", async () => {
    const el = await mount([]);
    expect($(el, '[data-id="empty"]')).not.toBeNull();
    expect($(el, ".gift")).toBeNull();
  });

  it("pauses a gift for the chosen months and tells the dashboard", async () => {
    const el = await mount([ACTIVE]);
    const changed = jest.fn();
    el.addEventListener("giftschange", changed);
    manageMonthlyGift.mockResolvedValue({
      message: "Paused from 10/23/2026 to 1/22/2027.",
      gifts: [{ ...PAUSED, pausedUntil: "2027-01-22" }]
    });

    click(el, "open-pause");
    await flush();
    const months = $(el, '[data-id="months"]');
    months.value = "3";
    months.dispatchEvent(new CustomEvent("change"));
    click(el, "confirm-pause");
    await flush();

    expect(manageMonthlyGift).toHaveBeenCalledWith({
      giftId: "gc1",
      operation: "pause",
      pauseMonths: 3,
      newAmount: null
    });
    expect(text(el, '[data-id="notice"]')).toContain("Paused from");
    expect(text(el, '[data-id="status"]')).toBe("Paused until 22 Jan 2027");
    expect(text(el, '[data-id="pause-note"]')).toBe(
      "No gifts from 23 Oct 2026 to 22 Jan 2027. Resume any time."
    );
    expect($(el, ".gift").classList.contains("gift_paused")).toBe(true);
    expect($(el, '[data-action="resume"]')).not.toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("abchope:giftsChangedAt")).not.toBeNull();
  });

  it("resumes a paused gift", async () => {
    const el = await mount([PAUSED]);
    manageMonthlyGift.mockResolvedValue({
      message: "The recurring gift has been resumed.",
      gifts: [ACTIVE]
    });
    click(el, "resume");
    await flush();
    expect(manageMonthlyGift).toHaveBeenCalledWith(
      expect.objectContaining({ giftId: "gc1", operation: "resume" })
    );
    expect(text(el, '[data-id="status"]')).toBe("Active");
    expect($(el, '[data-id="pause-note"]')).toBeNull();
  });

  it("reloads when a gift changes elsewhere on the page (e.g. the assistant)", async () => {
    const el = await mount([ACTIVE]);
    getMonthlyGifts.mockResolvedValue([PAUSED]);
    window.dispatchEvent(new CustomEvent("abchope:giftschange"));
    await flush();
    expect(text(el, '[data-id="status"]')).toBe("Paused until 22 Dec 2026");
  });

  it("validates a new amount before calling the server", async () => {
    const el = await mount([ACTIVE]);
    manageMonthlyGift.mockResolvedValue({
      message: "The monthly amount is now USD 800, starting 10/23/2026.",
      gifts: [{ ...ACTIVE, amount: 800 }]
    });
    click(el, "open-amount");
    await flush();
    const amount = $(el, '[data-id="amount"]');

    amount.value = "50";
    amount.dispatchEvent(new CustomEvent("input"));
    click(el, "confirm-amount");
    await flush();
    expect(text(el, '[data-id="error"]')).toContain("between USD 100");
    expect(manageMonthlyGift).not.toHaveBeenCalled();

    amount.value = "800";
    amount.dispatchEvent(new CustomEvent("input"));
    click(el, "confirm-amount");
    await flush();
    expect(manageMonthlyGift).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "change_amount", newAmount: 800 })
    );
    expect(text(el, ".gift-amount")).toBe("USD 800 / month");
  });

  it("asks before cancelling and keeps the gift on 'Keep my gift'", async () => {
    const el = await mount([ACTIVE]);
    click(el, "open-cancel");
    await flush();
    expect(text(el, ".panel-warn")).toContain("Cancel this recurring gift?");

    $(el, ".panel-warn .btn-quiet").dispatchEvent(new CustomEvent("click"));
    await flush();
    expect($(el, ".panel-warn")).toBeNull();
    expect(manageMonthlyGift).not.toHaveBeenCalled();

    manageMonthlyGift.mockResolvedValue({
      message: "The recurring gift has been cancelled.",
      gifts: []
    });
    click(el, "open-cancel");
    await flush();
    click(el, "confirm-cancel");
    await flush();
    expect(manageMonthlyGift).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "cancel" })
    );
    expect($(el, ".gift")).toBeNull();
    expect($(el, '[data-id="empty"]')).not.toBeNull();
  });

  it("shows the server's message when a change fails", async () => {
    const el = await mount([ACTIVE]);
    manageMonthlyGift.mockRejectedValue({
      body: { message: "This recurring gift could not be found." }
    });
    click(el, "open-cancel");
    await flush();
    click(el, "confirm-cancel");
    await flush();
    expect(text(el, '[data-id="error"]')).toBe(
      "This recurring gift could not be found."
    );
    expect($(el, ".gift")).not.toBeNull();
  });

  it("formats Apex dates without shifting the day", () => {
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDate(null)).toBe("");
  });
});
