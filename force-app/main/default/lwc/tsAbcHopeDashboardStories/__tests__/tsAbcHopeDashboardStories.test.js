import { createElement } from "lwc";
import DashboardStories from "c/tsAbcHopeDashboardStories";
import getPrograms from "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms";

jest.mock(
  "@salesforce/apex/TSAbcHopeDonationIntakeController.getPrograms",
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

describe("c-ts-abc-hope-dashboard-stories", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows each story with its program's Image URL, else a photo for the name", async () => {
    const el = createElement("c-ts-abc-hope-dashboard-stories", {
      is: DashboardStories
    });
    el.config =
      "Clean Water|Water story|Text.|Clean Water;Education|School story|Text.;Environment|Tree story|Text.|Green Communities";
    document.body.appendChild(el);
    getPrograms.emit([
      { name: "Clean Water", imageUrl: "https://cdn.test/water.jpg" },
      { name: "Education Access", imageUrl: "https://cdn.test/school.jpg" },
      { name: "Green Communities" }
    ]);
    await Promise.resolve();
    const imgs = [...el.shadowRoot.querySelectorAll(".story img")].map((i) =>
      i.getAttribute("src")
    );
    expect(imgs[0]).toBe("https://cdn.test/water.jpg");
    // No program named: the tag "Education" finds Education Access.
    expect(imgs[1]).toBe("https://cdn.test/school.jpg");
    // The program has no Image URL: a photo chosen from its name.
    expect(imgs[2]).toContain("images.unsplash.com/");
    expect(
      [...el.shadowRoot.querySelectorAll(".story-title")].map(
        (t) => t.textContent
      )
    ).toEqual(["Water story", "School story", "Tree story"]);
  });
});
