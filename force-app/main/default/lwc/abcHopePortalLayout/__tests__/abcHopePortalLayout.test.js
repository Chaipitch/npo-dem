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

describe("c-abc-hope-portal-layout active sidebar item", () => {
  const { CurrentPageReference } = require("lightning/navigation");
  const flush = () => Promise.resolve().then(() => Promise.resolve());
  const activeLabels = (el) =>
    [...el.shadowRoot.querySelectorAll(".nav-item_on")].map((a) =>
      a.textContent.trim()
    );
  beforeAll(() => {
    // Run the "after the router has moved" re-read at once.
    window.requestAnimationFrame = (cb) => {
      cb();
      return 0;
    };
  });
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
    window.history.replaceState(null, "", "/");
  });
  function mountAt(url) {
    window.history.replaceState(null, "", url);
    const el = createElement("c-abc-hope-portal-layout", {
      is: AbcHopePortalLayout
    });
    document.body.appendChild(el);
    return el;
  }

  it("ignores the query string on first load", async () => {
    const el = mountAt("/dashboard?t=123");
    await flush();
    expect(activeLabels(el)).toEqual(["Home"]);
  });

  it("follows section links and router navigation", async () => {
    const el = mountAt("/dashboard");
    await flush();
    window.history.pushState(null, "", "/dashboard#campaigns");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flush();
    expect(activeLabels(el)).toEqual(["Campaigns"]);

    // The LWR router moves without hashchange/popstate; the page reference wire fires instead.
    window.history.pushState(null, "", "/my-profile");
    CurrentPageReference.emit({ attributes: { name: "My_Profile__c" } });
    await flush();
    expect(activeLabels(el)).toEqual(["My Profile"]);
  });

  it("highlights the clicked item straight away", async () => {
    const el = mountAt("/dashboard");
    await flush();
    const stories = [...el.shadowRoot.querySelectorAll(".nav-item")].find(
      (a) => a.textContent.trim() === "Stories"
    );
    window.history.pushState(null, "", "/dashboard#stories");
    stories.dispatchEvent(new CustomEvent("click"));
    await flush();
    expect(activeLabels(el)).toEqual(["Stories"]);
  });
});
