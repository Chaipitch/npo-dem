import { createElement } from "lwc";
import AbcHopeAbout from "c/tsAbcHopeAbout";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);

describe("c-ts-abc-hope-about", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("renders the placeholder copy, facts, links and demo note", () => {
    const el = createElement("c-ts-abc-hope-about", { is: AbcHopeAbout });
    document.body.appendChild(el);
    const $ = (s) => el.shadowRoot.querySelector(s);
    expect($(".title").textContent).toBe("About ABC Hope");
    expect(el.shadowRoot.querySelectorAll(".para")).toHaveLength(3);
    expect(el.shadowRoot.querySelectorAll(".fact")).toHaveLength(4);
    expect($('[data-id="donate"]').getAttribute("href")).toBe("/donate");
    expect($('[data-id="our-work"]').getAttribute("href")).toBe("/our-work");
    expect($('[data-id="demo-note"]').textContent).toContain(
      "Payment simulation only"
    );
  });
});
