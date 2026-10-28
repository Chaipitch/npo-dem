import { createElement } from "lwc";
import DashboardImpact from "c/tsAbcHopeDashboardImpact";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

describe("c-ts-abc-hope-dashboard-impact", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("fills People Reached, Communities, Programs and Volunteers with live figures", async () => {
    const el = createElement("c-ts-abc-hope-dashboard-impact", {
      is: DashboardImpact
    });
    el.config =
      "{peopleReached}|People Reached;{communities}|Communities;{programs}|Programs;{volunteers}|Volunteers Engaged;12|Typed";
    el.data = {
      activePrograms: 8,
      peopleReached: 1002,
      communities: 2415,
      volunteersEngaged: 96
    };
    document.body.appendChild(el);
    await Promise.resolve();
    const tiles = [...el.shadowRoot.querySelectorAll(".impact-tile")].map(
      (t) => [
        t.querySelector(".impact-label").textContent,
        t.querySelector(".impact-value").textContent
      ]
    );
    expect(tiles).toEqual([
      ["People Reached", "1,002"],
      ["Communities", "2,415"],
      ["Programs", "8"],
      ["Volunteers Engaged", "96"],
      ["Typed", "12"]
    ]);
  });

  it("shows … until the figures load", async () => {
    const el = createElement("c-ts-abc-hope-dashboard-impact", {
      is: DashboardImpact
    });
    el.config = "{programs}|Programs";
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el.shadowRoot.querySelector(".impact-value").textContent).toBe("…");
  });
});
