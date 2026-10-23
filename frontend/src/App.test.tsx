import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import App from "./App";
import { api, post } from "./api";
vi.mock("./api", () => ({
  api: vi.fn(),
  post: vi.fn(),
  ApiError: class ApiError extends Error {
    code = "TEST";
  },
}));
const call = vi.mocked(api);
const send = vi.mocked(post);
const cfg = {
  market: "CN",
  demo: false,
  generation_enabled: false,
  provider: "unavailable",
  features: { community: false, video: false, payments: false },
  upload: { max_bytes: 10485760, mime_types: ["image/png"] },
};
const version = {
  id: "v1",
  root_version_id: "v1",
  parent_version_id: null,
  story_world_id: "world1",
  creator_id: "u1",
  title: "A test concept",
  caption: "A real response from the API.",
  image_url: null,
  source_id: null,
  depth: 0,
  remix_allowed: true,
  safety_state: "HOLD",
  demo: true,
  created_at: 1780000000,
};
function Back() {
  const nav = useNavigate();
  return <button onClick={() => nav(-1)}>Test browser back</button>;
}
function mount(path = "/create", entries?: string[]) {
  return render(
    <MemoryRouter initialEntries={entries || [path]}>
      <App />
      <Back />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  call.mockImplementation(async (path: string) => {
    if (path === "/config") return cfg;
    if (path === "/auth/me") throw Error("not signed in");
    throw Error("unexpected " + path);
  });
  send.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
describe("unified application integration", () => {
  it("preserves text across locale switching and route navigation", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "文字" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文字" }), {
      target: { value: "An idea worth keeping" },
    });
    fireEvent.click(screen.getByRole("button", { name: "界面语言" }));
    expect(
      screen.getByRole("textbox", { name: "Text" }).getAttribute("placeholder"),
    ).toContain("What happened");
    expect(
      (screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement)
        .value,
    ).toBe("An idea worth keeping");
    fireEvent.click(screen.getAllByRole("link", { name: "My creations" })[0]);
    await screen.findByText("Log in to keep your creative journey.");
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    expect(
      (screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement)
        .value,
    ).toBe("An idea worth keeping");
    expect(sessionStorage.getItem("eupra.draft")).toBe("An idea worth keeping");
  });
  it("preserves chosen upload when changing language", async () => {
    const old = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:private-preview");
    mount();
    const file = new File(["image bytes"], "cat.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择图片"), {
      target: { files: [file] },
    });
    expect(screen.getByAltText("图片").getAttribute("src")).toBe(
      "blob:private-preview",
    );
    fireEvent.click(screen.getByRole("button", { name: "界面语言" }));
    expect(screen.getByAltText("Photo").getAttribute("src")).toBe(
      "blob:private-preview",
    );
    URL.createObjectURL = old;
  });
  it("dismisses auth via Escape and explicit close without losing draft", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "文字" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文字" }), {
      target: { value: "keep me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "关闭" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: "文字" }) as HTMLTextAreaElement)
        .value,
    ).toBe("keep me");
  });
  it("dismisses auth on a browser-back route change", async () => {
    mount("/create", ["/", "/create"]);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("人生，")).toBeTruthy();
  });
  it("never uploads or creates a job when generation is unavailable", async () => {
    mount();
    await waitFor(() => expect(call).toHaveBeenCalledWith("/config"));
    fireEvent.click(screen.getByRole("button", { name: "文字" }));
    fireEvent.change(screen.getByRole("textbox", { name: "文字" }), {
      target: { value: "hello world" },
    });
    fireEvent.click(screen.getByRole("button", { name: "让它发生点什么" }));
    expect(screen.getByRole("status").textContent).toContain(
      "生成服务尚未配置",
    );
    expect(
      call.mock.calls.some(
        (c) => c[0] === "/uploads" || c[0] === "/generation-jobs",
      ),
    ).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("routes a completed API demo job to a clearly labeled text-only result", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path: string) => {
      if (path === "/config")
        return { ...cfg, demo: true, generation_enabled: true };
      if (path === "/auth/me")
        return { user: { id: "u1", email: "me@example.test" } };
      if (path === "/generation-jobs/job1")
        return {
          id: "job1",
          status: "succeeded",
          stage: "DEMO_DRAFT",
          version_id: "v1",
          demo: true,
        };
      if (path === "/versions/v1") return version;
      throw Error(path);
    });
    mount("/jobs/job1");
    await screen.findAllByText("A test concept");
    expect(
      screen.getByText("Text concept demo · No image generated"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "This demo creates a text concept only. No generated image is being claimed.",
      ),
    ).toBeTruthy();
    expect(document.querySelector(".result-art>img")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Push it further" })
        .getAttribute("href"),
    ).toBe("/remix/v1");
    expect(screen.queryByText("100%")).toBeNull();
  });
  it("renders mobile navigation without CN community links", () => {
    mount();
    const nav = document.querySelector(".mobile-nav")!;
    expect(nav.querySelectorAll("a").length).toBe(3);
    expect(
      Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    ).toEqual(["/create", "/works", "/settings"]);
    expect(document.querySelector('a[href="/feed"]')).toBeNull();
  });
  it("uses immutable root relationships, not list position, in the world view", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const child = {
      ...version,
      id: "v2",
      parent_version_id: "v1",
      depth: 1,
      title: "Child concept",
    };
    call.mockImplementation(async (path: string) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("not signed in");
      if (path === "/story-worlds/world1") return { items: [child, version] };
      throw Error(path);
    });
    mount("/worlds/world1");
    await screen.findAllByText("Child concept");
    const nodes = document.querySelectorAll(".timeline-node");
    expect(nodes[0].textContent).toContain("Story root");
    expect(nodes[0].textContent).toContain("A test concept");
    expect(nodes[1].textContent).toContain("Parent version · v1");
  });
  it("welcome is a distinct original-art entry and text shortcut changes the mode", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    mount("/welcome");
    expect(document.querySelector(".welcome-portal")?.getAttribute("src")).toBe(
      "/assets/portal-world.svg",
    );
    expect(document.querySelector(".hero")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Write a thought" }));
    expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
  });
  it("library searches, filters originals/remixes and persists favorite toggles", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const child = {
      ...version,
      id: "v2",
      parent_version_id: "v1",
      depth: 1,
      title: "Moon branch",
      favorite: false,
    };
    call.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/me/works") return { items: [child, version] };
      if (path === "/versions/v2/favorite") return { ...child, favorite: true };
      throw Error(path);
    });
    mount("/works");
    await screen.findByRole("searchbox", { name: "Search your creations" });
    expect(document.querySelectorAll(".work-card").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Originals" }));
    expect(document.querySelectorAll(".work-card").length).toBe(1);
    expect(document.querySelector(".work-card")?.textContent).toContain(
      "A test concept",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remixes" }));
    expect(document.querySelectorAll(".work-card").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Favorite creation" }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("/versions/v2/favorite", {
        method: "PATCH",
        body: JSON.stringify({ favorite: true }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(document.querySelectorAll(".work-card").length).toBe(1);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "no such title" },
    });
    expect(screen.getByText("No matching versions")).toBeTruthy();
  });
  it("remix submission uses the selected historical parent, not the route parent", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const child = {
      ...version,
      id: "v2",
      parent_version_id: "v1",
      depth: 1,
      title: "Moon branch",
    };
    call.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/config")
        return { ...cfg, generation_enabled: true, demo: true };
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/versions/v2") return child;
      if (path === "/story-worlds/world1") return { items: [child, version] };
      if (path === "/generation-jobs")
        return { id: "newjob", status: "queued" };
      if (path === "/generation-jobs/newjob")
        return { id: "newjob", status: "queued", stage: "REQUEST_INTAKE" };
      throw Error(path);
    });
    mount("/remix/v2");
    const strip = await screen.findByRole("group", {
      name: "Browse story versions",
    });
    fireEvent.click(
      await within(strip).findByRole("button", { name: /A test concept/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Push it further" }));
    await waitFor(() => {
      const request = call.mock.calls.find((c) => c[0] === "/generation-jobs");
      expect(request).toBeTruthy();
      expect(JSON.parse(request![1]!.body as string).parent_version_id).toBe(
        "v1",
      );
    });
  });
  it("only design examples offer the labeled poster exporter", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const view = mount("/examples/ceo");
    expect(
      screen.getByRole("button", { name: "Download example poster" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Exports a labeled official design example, not a new generation.",
      ),
    ).toBeTruthy();
    view.unmount();
    call.mockImplementation(async (path: string) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("not signed in");
      if (path === "/versions/v1") return version;
      throw Error(path);
    });
    mount("/share/v1");
    await screen.findByText("A test concept");
    expect(
      screen.queryByRole("button", { name: "Download example poster" }),
    ).toBeNull();
    expect(screen.getByText(/This creation is on safety hold/)).toBeTruthy();
  });
  it("local preview requires explicit checkbox review before capability creation", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path: string) => {
      if (path === "/config")
        return {
          ...cfg,
          features: {
            ...cfg.features,
            local_review: true,
            share_preview: true,
          },
        };
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/versions/v1") return version;
      throw Error(path);
    });
    send.mockImplementation(async (path: string) =>
      path === "/share-links"
        ? { id: "link1", token: "test-capability" }
        : { approved: true },
    );
    mount("/share/v1");
    const create = await screen.findByRole("button", {
      name: "Create local preview link",
    });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(create);
    await screen.findByRole("link", { name: "Open local preview" });
    expect(send).toHaveBeenCalledWith("/versions/v1/local-review", {
      approved: true,
    });
    expect(send).toHaveBeenCalledWith("/share-links", { version_id: "v1" });
    expect(screen.getByText(/This creation is on safety hold/)).toBeTruthy();
  });
  it("shared-text remix sends both source version and capability token", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path: string) => {
      if (path === "/config")
        return { ...cfg, demo: true, generation_enabled: true };
      if (path === "/auth/me") return { user: { id: "u2" } };
      if (path === "/share/test-token")
        return { version, development_preview: true, requires_auth: true };
      if (path === "/generation-jobs") return { id: "j2", status: "queued" };
      if (path === "/generation-jobs/j2")
        return { id: "j2", status: "queued", stage: "REQUEST_INTAKE" };
      throw Error(path);
    });
    mount("/s/test-token");
    fireEvent.click(
      await screen.findByRole("button", { name: "Push it further" }),
    );
    await waitFor(() => {
      const request = call.mock.calls.find((c) => c[0] === "/generation-jobs");
      expect(request).toBeTruthy();
      const body = JSON.parse(request![1]!.body as string);
      expect(body.parent_version_id).toBe("v1");
      expect(body.share_token).toBe("test-token");
    });
  });
  it("does not infer draft lifecycle from HOLD or mislabel live text concepts as demo", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const live = { ...version, demo: false };
    call.mockImplementation(async (path: string) => {
      if (path === "/config")
        return { ...cfg, generation_enabled: true, provider: "http" };
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/me/works") return { items: [live] };
      if (path === "/story-worlds/world1") return { items: [live] };
      throw Error(path);
    });
    const view = mount("/works");
    await screen.findByRole("searchbox");
    expect(screen.queryByRole("button", { name: "Drafts" })).toBeNull();
    view.unmount();
    mount("/worlds/world1");
    await screen.findByText("Text concept · No image");
    expect(
      screen.queryByText("Text concept demo · No image generated"),
    ).toBeNull();
  });
  it.each(["UNKNOWN", "REJECTED", "FAILED"])(
    "does not display %s safety state as approved",
    async (safety_state) => {
      localStorage.setItem("eupra.locale", "en-US");
      call.mockImplementation(async (path: string) => {
        if (path === "/config") return cfg;
        if (path === "/auth/me") return { user: { id: "u1" } };
        if (path === "/versions/v1") return { ...version, safety_state };
        throw Error(path);
      });
      mount("/result/v1");
      await screen.findByText("Not safety approved");
      expect(screen.queryByText("Safety approved")).toBeNull();
      expect(screen.queryByText("Local preview reviewed")).toBeNull();
    },
  );
});
