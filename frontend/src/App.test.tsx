import { transferableAbortController } from "node:util";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
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
  return (
    <>
      <button onClick={() => nav(-1)}>Test browser back</button>
      <button onClick={() => nav(1)}>Test browser forward</button>
    </>
  );
}
function mount(path = "/create", entries?: string[]) {
  return render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "*",
            element: (
              <>
                <App />
                <Back />
              </>
            ),
          },
        ],
        { initialEntries: entries || [path] },
      )}
    />,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal(
    "AbortController",
    class {
      constructor() {
        return transferableAbortController();
      }
    },
  );
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Reveal this version" }),
    );
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
        .getByRole("link", { name: "Choose a direction and version" })
        .getAttribute("href"),
    ).toBe("/remix/v1?version=v1");
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
  it("restores selected version from world query and preserves it in remix return", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const child = {
      ...version,
      id: "v2",
      parent_version_id: "v1",
      depth: 1,
      title: "Child node",
    };
    call.mockImplementation(async (path: string) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/story-worlds/world1")
        return { items: [child, version], ancestor_references: [] };
      if (path === "/versions/v2") return child;
      if (path.endsWith("/contributions")) return { record_available: false };
      throw Error(path);
    });
    const view = mount("/worlds/world1?version=v1");
    await screen.findByRole("group", { name: "Browse story versions" });
    expect(
      document.querySelector(".version-strip button[aria-pressed=true]")
        ?.textContent,
    ).toContain("A test concept");
    expect(
      document
        .querySelector(".world-context a.btn.primary")
        ?.getAttribute("href"),
    ).toBe("/remix/v1");
    view.unmount();
    mount("/remix/v2?version=v1");
    await waitFor(() =>
      expect(
        document.querySelector(".version-strip button[aria-pressed=true]")
          ?.textContent,
      ).toContain("A test concept"),
    );
    expect(
      screen
        .getByRole("link", { name: "Version lineage" })
        .getAttribute("href"),
    ).toBe("/worlds/world1?version=v1");
  });
  it("world query selection follows browser back and forward without resetting to latest", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const child = {
      ...version,
      id: "v2",
      parent_version_id: "v1",
      depth: 1,
      title: "Child node",
    };
    call.mockImplementation(async (path: string) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/story-worlds/world1") return { items: [child, version] };
      if (path.endsWith("/contributions")) return { record_available: false };
      throw Error(path);
    });
    mount("", ["/worlds/world1?version=v1", "/worlds/world1?version=v2"]);
    const target = () =>
      document
        .querySelector(".world-context a.btn.primary")
        ?.getAttribute("href");
    await waitFor(() => expect(target()).toBe("/remix/v2"));
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await waitFor(() => expect(target()).toBe("/remix/v1"));
    fireEvent.click(
      screen.getByRole("button", { name: "Test browser forward" }),
    );
    await waitFor(() => expect(target()).toBe("/remix/v2"));
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Browse story versions" }),
      ).getAllByRole("button")[0],
    );
    await waitFor(() => expect(target()).toBe("/remix/v1"));
  });
  it.each(["Choose a welcome photo", "Capture a welcome photo"])(
    "carries actual welcome input into creation: %s",
    async (label) => {
      localStorage.setItem("eupra.locale", "en-US");
      URL.createObjectURL = vi.fn(() => "blob:welcome-file");
      mount("/welcome");
      const file = new File(["image"], "photo.png", { type: "image/png" });
      fireEvent.change(screen.getByLabelText(label), {
        target: { files: [file] },
      });
      await waitFor(() =>
        expect(
          document
            .querySelector(".dropzone.has-image > img")
            ?.getAttribute("src"),
        ).toBe("blob:welcome-file"),
      );
      expect(call.mock.calls.some(([path]) => path === "/uploads")).toBe(false);
    },
  );
  it("requires cancellation confirmation and retries exact persisted input through server", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const running = {
      id: "j1",
      status: "running",
      stage: "PROVIDER_PIPELINE",
      demo: true,
      version_id: null,
      error: null,
    };
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/generation-jobs/j1") return running;
      if (path === "/generation-jobs/j1/retry") return { ...running, id: "j2" };
      if (path === "/generation-jobs/j2") return { ...running, id: "j2" };
      throw Error(path);
    });
    send.mockResolvedValue({
      ...running,
      status: "cancelled",
      stage: "CANCELLED",
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount("/jobs/j1");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel task" }));
    expect(send).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel task" }));
    const retry = await screen.findByRole("button", {
      name: "Retry original input",
    });
    expect(document.querySelector(".cp-stage-bars")).toBeNull();
    expect(document.querySelector(".cp-timing")).toBeNull();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(
        call.mock.calls.some(([path]) => path === "/generation-jobs/j1/retry"),
      ).toBe(true),
    );
    const request = call.mock.calls.find(
      ([path]) => path === "/generation-jobs/j1/retry",
    )![1]!;
    expect(request.body).toBe("{}");
    expect(request.headers).toHaveProperty("Idempotency-Key");
    confirm.mockRestore();
  });
  it("renders illustrated landing steps and an explicitly labeled local design video", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    mount("/");
    expect(document.querySelectorAll(".illustrated-steps article").length).toBe(
      3,
    );
    expect(
      document.querySelector(
        '.illustration-3 img[src="/assets/shiba-agent.webp"]',
      ),
    ).not.toBeNull();
    expect(
      screen.getByText("An original is a beginning. Not an ending."),
    ).toBeTruthy();
    const video = screen.getByLabelText(
      "Pre-made five-second design demonstration",
    );
    expect(video.querySelector("source")?.getAttribute("src")).toBe(
      "/assets/cn12_cinematic_demo_5s_en.webm",
    );
    expect(
      video.querySelector('source[type="video/mp4"]')?.getAttribute("src"),
    ).toBe("/assets/cn12_cinematic_demo_5s_en.mp4");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(
      screen.getByText(
        "Pre-made design demonstration only. Live video generation is not available.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Interface language" }));
    expect(
      screen
        .getByLabelText("预制5秒设计视频演示")
        .querySelector('source[type="video/mp4"]')
        ?.getAttribute("src"),
    ).toBe("/assets/cn12_cinematic_demo_5s.mp4");
  });
  it("shows a truthful playback error and original-file fallback", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    mount("/");
    fireEvent.error(
      screen.getByLabelText("Pre-made five-second design demonstration"),
    );
    expect(screen.getByRole("alert").textContent).toContain("could not play");
    const download = screen.getByRole("link", {
      name: "Download original design video (MP4)",
    });
    expect(download.getAttribute("href")).toBe(
      "/assets/cn12_cinematic_demo_5s_en.mp4",
    );
    expect(download.hasAttribute("download")).toBe(true);
  });
  it("does not swallow a rejected explicit play request", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("codec unsupported"));
    mount("/");
    const video = screen.getByLabelText(
      "Pre-made five-second design demonstration",
    );
    video.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Play design video" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("could not play"),
    );
    expect(play).toHaveBeenCalledOnce();
    play.mockRestore();
  });
  it.each(["/create", "/settings", "/jobs/j1", "/share/v1"])(
    "uses light app chrome without a website footer on %s",
    async (path) => {
      localStorage.setItem("eupra.locale", "en-US");
      mount(path);
      expect(document.querySelector(".site.light-app-shell")).not.toBeNull();
      expect(document.querySelector("footer")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Interface language" }),
      ).toBeTruthy();
      expect(document.querySelector("header nav")).toBeNull();
      if (path === "/settings")
        expect(
          document.querySelector('header a[href="#personal-preferences"]'),
        ).not.toBeNull();
    },
  );
  it("retains the website footer only on the marketing landing", () => {
    mount("/");
    expect(document.querySelector("footer")).not.toBeNull();
    expect(document.querySelector("header nav")).not.toBeNull();
  });
  it("blocks active-task browser Back and Forward unless departure is confirmed", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("guest");
      if (path === "/generation-jobs/j1")
        return {
          id: "j1",
          status: "running",
          stage: "PROVIDER_PIPELINE",
          version_id: null,
          demo: true,
          error: null,
        };
      throw Error(path);
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount("", ["/works", "/jobs/j1", "/create"]);
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await screen.findByRole("button", { name: "Cancel task" });
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(document.querySelector(".job-page")).not.toBeNull();
    confirm.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: "Test browser forward" }),
    );
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(document.querySelector(".job-page")).not.toBeNull();
    confirm.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Test browser forward" }),
    );
    await waitFor(() =>
      expect(document.querySelector(".create-page")).not.toBeNull(),
    );
    confirm.mockRestore();
  });
  it("creates a direct continuation using exactly the current result parent", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path, options) => {
      if (path === "/config") return { ...cfg, generation_enabled: true };
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/versions/v1") return version;
      if (path === "/generation-jobs") return { id: "j2", status: "queued" };
      if (path === "/generation-jobs/j2")
        return {
          id: "j2",
          status: "queued",
          stage: "REQUEST_INTAKE",
          demo: true,
        };
      throw Error(path);
    });
    mount("/result/v1");
    fireEvent.click(
      await screen.findByRole("button", { name: "Push it further" }),
    );
    await waitFor(() =>
      expect(call.mock.calls.some(([p]) => p === "/generation-jobs")).toBe(
        true,
      ),
    );
    const request = call.mock.calls.find(
      ([p]) => p === "/generation-jobs",
    )![1]!;
    expect(JSON.parse(request.body as string)).toEqual({
      kind: "continuation",
      parent_version_id: "v1",
      locale: "en",
    });
  });
  it("only displays actual child branches and navigates to the chosen child", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("guest");
      if (path === "/versions/v1") return version;
      if (path === "/versions/v1/children")
        return {
          items: [
            {
              ...version,
              id: "child",
              parent_version_id: "v1",
              title: "Owned child",
            },
          ],
        };
      if (path === "/versions/child")
        return {
          ...version,
          id: "child",
          parent_version_id: "v1",
          title: "Owned child",
        };
      throw Error(path);
    });
    mount("/result/v1");
    fireEvent.click(
      await screen.findByRole("button", { name: "Browse existing branches" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Owned child/ }));
    await waitFor(() =>
      expect(document.querySelector(".result-art-title h1")?.textContent).toBe(
        "Owned child",
      ),
    );
  });
  it("searches server world names and retains filters after opening a detail", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/me/works") return { items: [version] };
      if (path === "/me/story-worlds")
        return { items: [{ id: "world1", title: "Unique world name" }] };
      if (path === "/versions/v1") return version;
      throw Error(path);
    });
    mount("/works");
    fireEvent.change(await screen.findByRole("searchbox"), {
      target: { value: "Unique world name" },
    });
    await waitFor(() =>
      expect(document.querySelectorAll(".work-card").length).toBe(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Originals" }));
    fireEvent.click(document.querySelector(".work-card .work-image")!);
    await screen.findByRole("button", { name: "Push it further" });
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await waitFor(() =>
      expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
        "Unique world name",
      ),
    );
    expect(
      screen
        .getByRole("button", { name: "Originals" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.querySelector(".work-growth")?.getAttribute("href")).toBe(
      "/worlds/world1?version=v1",
    );
  });
  it("explains a backend timeout without claiming a successful result", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("guest");
      if (path === "/generation-jobs/j1")
        return {
          id: "j1",
          status: "failed",
          stage: "FAILED",
          error: { code: "PIPELINE_TIMEOUT" },
          demo: false,
        };
      throw Error(path);
    });
    mount("/jobs/j1");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "server confirmed",
    );
    expect(
      screen.queryByRole("button", { name: "Reveal this version" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry original input" }),
    ).toBeTruthy();
  });
  it("hydrates account locale once and persists explicit header changes without route resets", async () => {
    call.mockImplementation(async (path, options) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/me/settings")
        return { locale: options?.method === "PATCH" ? "zh-CN" : "en" };
      if (path === "/me/works" || path === "/me/story-worlds")
        return { items: [] };
      throw Error(path);
    });
    mount("/create");
    fireEvent.click(
      await screen.findByRole("button", { name: "Interface language" }),
    );
    await waitFor(() =>
      expect(
        call.mock.calls.some(
          ([p, o]) => p === "/me/settings" && o?.method === "PATCH",
        ),
      ).toBe(true),
    );
    fireEvent.click(document.querySelector('.mobile-nav a[href="/works"]')!);
    await waitFor(() =>
      expect(
        document
          .querySelector('.mobile-nav a[aria-current="page"]')
          ?.getAttribute("href"),
      ).toBe("/works"),
    );
    expect(screen.getByRole("button", { name: "界面语言" })).toBeTruthy();
    expect(
      call.mock.calls.filter(([p, o]) => p === "/me/settings" && !o).length,
    ).toBe(1);
  });
  it("creator view shows account-wide server counts rather than one world", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") return { user: { id: "u1" } };
      if (path === "/story-worlds/world1") return { items: [version] };
      if (path === "/me/story-worlds")
        return {
          items: [
            { id: "world1", title: "First world", version_count: 1 },
            { id: "world2", title: "Second world", version_count: 23 },
          ],
        };
      if (path === "/me/creator-summary")
        return {
          profile: {
            nickname: "Actual creator",
            bio: "Private creator bio",
            avatar_url: "/api/v1/uploads/avatar",
          },
          stats: { worlds: 7, versions: 24 },
        };
      if (path.endsWith("/contributions")) return { record_available: false };
      throw Error(path);
    });
    mount("/worlds/world1");
    fireEvent.click(await screen.findByRole("button", { name: "Creator" }));
    await screen.findByText("Actual creator");
    expect(screen.getByText("Private creator bio")).toBeTruthy();
    expect(
      document.querySelector(".creator-profile > img")?.getAttribute("src"),
    ).toBe("/api/v1/uploads/avatar");
    expect(
      screen.getByRole("link", { name: /Second world/ }).getAttribute("href"),
    ).toBe("/worlds/world2");
    expect(
      document.querySelector(".creator-profile .library-stats")?.textContent,
    ).toContain("24");
    expect(
      document.querySelector(".creator-profile .library-stats")?.textContent,
    ).toContain("7");
  });
  it("keeps and saves the selected guest language when creating an account", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    call.mockImplementation(async (path, options) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("guest");
      if (path === "/me/settings")
        return { locale: options?.method === "PATCH" ? "en" : "zh-CN" };
      throw Error(path);
    });
    send.mockResolvedValue({ user: { id: "new-user" } });
    mount("/create");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "fixture@example.test" },
    });
    fireEvent.change(
      screen.getByLabelText("Password (at least 10 characters)"),
      { target: { value: "synthetic-password" } },
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create account",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.getByRole("button", { name: "Interface language" }),
    ).toBeTruthy();
    const saved = call.mock.calls.find(
      ([p, o]) => p === "/me/settings" && o?.method === "PATCH",
    );
    expect(JSON.parse(saved![1]!.body as string)).toEqual({ locale: "en-US" });
    expect(
      call.mock.calls.filter(([p, o]) => p === "/me/settings" && !o).length,
    ).toBe(0);
  });
  it("guards unknown pending jobs immediately and releases only on a terminal response", async () => {
    localStorage.setItem("eupra.locale", "en-US");
    let finish!: (value: any) => void;
    call.mockImplementation(async (path) => {
      if (path === "/config") return cfg;
      if (path === "/auth/me") throw Error("guest");
      if (path === "/generation-jobs/j1")
        return new Promise((resolve) => {
          finish = resolve;
        });
      if (path === "/versions/v1") return version;
      throw Error(path);
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount("", ["/works", "/jobs/j1"]);
    fireEvent.click(screen.getByRole("button", { name: "Test browser back" }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        "Leave before task status is known? The task may still be running. You can return to check it.",
      ),
    );
    expect(document.querySelector(".job-page")).not.toBeNull();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    confirm.mockClear();
    finish({
      id: "j1",
      status: "succeeded",
      stage: "DRAFT",
      version_id: "v1",
      demo: true,
      error: null,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Reveal this version" }),
    );
    await waitFor(() =>
      expect(document.querySelector(".result-page")).not.toBeNull(),
    );
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
