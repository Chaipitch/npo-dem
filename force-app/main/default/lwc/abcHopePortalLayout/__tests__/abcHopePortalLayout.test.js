import { createElement } from "lwc";
import AbcHopePortalLayout from "c/abcHopePortalLayout";

jest.mock(
  "@salesforce/community/basePath",
  () => ({ __esModule: true, default: "" }),
  { virtual: true }
);
jest.mock(
  "@salesforce/user/Id",
  () => ({ __esModule: true, default: "005xx" }),
  {
    virtual: true
  }
);
jest.mock(
  "@salesforce/user/isGuest",
  () => ({ __esModule: true, default: false }),
  {
    virtual: true
  }
);

describe("c-abc-hope-portal-layout header question box", () => {
  let received;
  const onAsk = (event) => {
    received.push(event.detail.question);
    event.detail.handled = true; // as the dashboard panel does, so no navigation happens
  };
  beforeEach(() => {
    received = [];
    window.addEventListener("abchope:ask", onAsk);
  });
  afterEach(() => {
    window.removeEventListener("abchope:ask", onAsk);
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  function mount() {
    const el = createElement("c-abc-hope-portal-layout", {
      is: AbcHopePortalLayout
    });
    document.body.appendChild(el);
    return el;
  }

  it("sends the typed question to the agent panel on Enter and clears the box", () => {
    const el = mount();
    const input = el.shadowRoot.querySelector('input[type="search"]');
    expect(input.placeholder).toBe(
      "Ask a question about your giving or our campaigns…"
    );
    input.value = "  Which campaigns are open?  ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(received).toEqual(["Which campaigns are open?"]);
    expect(input.value).toBe("");
  });

  it("ignores Enter on an empty box and other keys", () => {
    const el = mount();
    const input = el.shadowRoot.querySelector('input[type="search"]');
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    input.value = "hello";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(received).toEqual([]);
  });
});
