import { createElement } from "lwc";
import DashboardJourney from "c/tsAbcHopeDashboardJourney";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

const text = (n) => n.textContent.replace(/\s+/g, " ").trim();

function mount(years) {
  const el = createElement("c-ts-abc-hope-dashboard-journey", {
    is: DashboardJourney
  });
  el.years = years;
  document.body.appendChild(el);
  return Promise.resolve().then(() => el);
}

describe("c-ts-abc-hope-dashboard-journey", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows the impact journey as one card per year", async () => {
    const el = await mount([
      { year: "2023", joined: true, total: 0, giftCount: 0, items: [] },
      {
        year: "2024",
        total: 1250,
        giftCount: 1,
        items: [
          {
            cause: "General Fund",
            program: "Fund for Children",
            amount: 1250,
            isNew: true
          },
          { cause: "Toys & Gifts", amount: 0, recurringOnly: true }
        ]
      }
    ]);
    const cards = [
      ...el.shadowRoot.querySelectorAll('[data-id="journey-year"]')
    ];
    expect(cards).toHaveLength(2);
    expect(text(cards[0].querySelector(".year"))).toBe("2023");
    expect(cards[0].querySelector(".badge_joined")).not.toBeNull();
    expect(text(cards[0].querySelector(".year-empty"))).toBe(
      "Joined ABC Hope as a supporter."
    );
    expect(text(cards[1].querySelector(".year-meta"))).toBe(
      "USD 1,250 · 1 gift"
    );
    const items = [...cards[1].querySelectorAll(".year-item")];
    expect(text(items[0].querySelector(".item-cause"))).toBe("General FundNew");
    expect(items[1].querySelector(".badge_new")).toBeNull();
    expect(text(items[0].querySelector(".item-program"))).toBe(
      "Fund for Children"
    );
    expect(text(items[0].querySelector(".item-amount"))).toBe("USD 1,250");
    expect(text(items[1].querySelector(".item-amount"))).toBe("Recurring gift");
  });

  it("scrolls a year's causes when there are more than 5", async () => {
    const items = (n) =>
      Array.from({ length: n }, (_, i) => ({
        cause: `Cause ${i + 1}`,
        amount: 100
      }));
    const el = await mount([
      { year: "2025", total: 500, giftCount: 5, items: items(5) },
      { year: "2026", total: 1100, giftCount: 11, items: items(11) }
    ]);
    const lists = [...el.shadowRoot.querySelectorAll(".year-items")];
    expect(lists[0].classList.contains("year-items_scroll")).toBe(false);
    expect(lists[0].getAttribute("tabindex")).toBeNull();
    expect(lists[1].classList.contains("year-items_scroll")).toBe(true);
    expect(lists[1].getAttribute("tabindex")).toBe("0");
    expect(lists[1].querySelectorAll(".year-item")).toHaveLength(11);
  });
});
