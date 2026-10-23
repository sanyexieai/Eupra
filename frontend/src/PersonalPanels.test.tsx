import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfileSettings, VideoStudio, VideoBalance } from "./PersonalPanels";
import { api, post, type Version } from "./api";
import zh from "./locales/personal-zh-CN.json";
import en from "./locales/personal-en-US.json";
vi.mock("./api", () => ({ api: vi.fn(), post: vi.fn() }));
const call = vi.mocked(api);
const version: Version = {
  id: "v1",
  root_version_id: "v1",
  parent_version_id: null,
  story_world_id: "w1",
  creator_id: "u1",
  title: "My real version",
  caption: "Owned work caption",
  image_url: "/owned.jpg",
  source_id: null,
  depth: 0,
  remix_allowed: true,
  safety_state: "SAFE",
  demo: false,
  created_at: 1,
};
const makeApp = () => ({
  locale: "en-US",
  user: { id: "u1", email: "owner@example.test" },
  setUser: vi.fn(),
  setAuth: vi.fn(),
  setLocale: vi.fn(),
  setNotice: vi.fn(),
  error: vi.fn(),
  config: {},
  t: (k: string) => k,
});
beforeEach(() => {
  vi.clearAllMocks();
  call.mockImplementation(async (path: string) => {
    if (path === "/me/video-credits")
      return {
        remaining: 1,
        daily_limit: 2,
        successful_today: 1,
        enabled: false,
      };
    if (path === "/me/works") return { items: [version] };
    if (path === "/me/settings")
      return { locale: "en", default_remix_allowed: false };
    throw Error(path);
  });
});
afterEach(cleanup);
describe("personal panels", () => {
  it("keeps the personal locale namespaces aligned", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });
  it("uses only owned works for recent works and labels illustrative artwork", async () => {
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("My real version")).toBeTruthy();
    expect(screen.getByText(en.examples)).toBeTruthy();
    expect(screen.getByText("owner@example.test")).toBeTruthy();
    expect(screen.queryByText("36")).toBeNull();
    expect(screen.queryByText("72")).toBeNull();
  });
  it("does not optimistically change preferences after a failed save", async () => {
    const app = makeApp();
    call.mockImplementation(async (path, options) => {
      if (path === "/me/settings") {
        if (options?.method === "PATCH") throw Error("offline");
        return { locale: "en", default_remix_allowed: false };
      }
      if (path === "/me/works") return { items: [] };
      return {
        remaining: 1,
        daily_limit: 2,
        successful_today: 1,
        enabled: false,
      };
    });
    render(
      <MemoryRouter>
        <ProfileSettings app={app} />
      </MemoryRouter>,
    );
    const toggle = await screen.findByRole("switch");
    await waitFor(() =>
      expect((toggle as HTMLInputElement).disabled).toBe(false),
    );
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(app.setNotice).toHaveBeenCalledWith(en.saveError),
    );
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });
  it("shows actual credit counts and no invented countdown or payment offer", async () => {
    render(
      <MemoryRouter>
        <VideoBalance app={makeApp()} />
      </MemoryRouter>,
    );
    const progress = await screen.findByRole("progressbar");
    expect(progress.getAttribute("value")).toBe("1");
    expect(progress.getAttribute("max")).toBe("2");
    expect(
      document.querySelectorAll(".pp-credit-segments > span"),
    ).toHaveLength(2);
    expect(
      document.querySelectorAll(".pp-credit-segments > .available"),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(".pp-credit-segments > .used"),
    ).toHaveLength(1);
    expect(screen.getByText(en.statusOff)).toBeTruthy();
    fireEvent.click(screen.getByText(en.policy));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(en.policyBody)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
  it("shows balance errors rather than replacing an unknown balance with 2", async () => {
    call.mockRejectedValue(Error("offline"));
    render(
      <MemoryRouter>
        <VideoBalance app={makeApp()} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });
  it("offers the labeled design clip without creating a job or spending credits", async () => {
    render(
      <MemoryRouter>
        <VideoStudio app={makeApp()} version={version} />
      </MemoryRouter>,
    );
    expect(screen.getByAltText(version.title).getAttribute("src")).toBe(
      "/owned.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: en.custom }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "A slow turn" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.demo }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(en.demoBody);
    const sources = dialog.querySelectorAll("video source");
    expect(sources[0].getAttribute("src")).toBe(
      "/assets/cn12_cinematic_demo_5s_en.webm",
    );
    expect(sources[1].getAttribute("src")).toBe(
      "/assets/cn12_cinematic_demo_5s_en.mp4",
    );
    expect(
      screen.getByRole("link", { name: en.download }).getAttribute("href"),
    ).toBe("/assets/cn12_cinematic_demo_5s_en.mp4");
    expect(post).not.toHaveBeenCalled();
    expect(
      call.mock.calls.every(([path]) => path === "/me/video-credits"),
    ).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("video credit context", () => {
  it("keeps the source version when opening credits and returns to that video", async () => {
    const a = makeApp();
    const { unmount } = render(
      <MemoryRouter>
        <VideoStudio app={a} version={version} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: en.credits }).getAttribute("href"),
    ).toBe("/balance?version=v1");
    unmount();
    call.mockImplementation(async (path) =>
      path === "/versions/v1"
        ? version
        : { remaining: 1, daily_limit: 2, successful_today: 1, enabled: false },
    );
    render(
      <MemoryRouter initialEntries={["/balance?version=v1"]}>
        <VideoBalance app={a} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    expect(
      screen.getByRole("link", { name: en.back }).getAttribute("href"),
    ).toBe("/video/v1");
    expect(
      screen
        .getByRole("link", { name: new RegExp(version.title) })
        .getAttribute("href"),
    ).toBe("/video/v1");
  });
  it("does not display a stale or unauthorized work when the return lookup fails", async () => {
    call.mockImplementation(async (path) => {
      if (path.startsWith("/versions/")) throw Error("not found");
      return {
        remaining: 1,
        daily_limit: 2,
        successful_today: 1,
        enabled: false,
      };
    });
    render(
      <MemoryRouter initialEntries={["/balance?version=private"]}>
        <VideoBalance app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByRole("alert");
    expect(screen.queryByText(version.title)).toBeNull();
    expect(
      screen.getByRole("link", { name: en.back }).getAttribute("href"),
    ).toBe("/settings");
  });
});

describe("demo playback fallback", () => {
  it("shows a visible error and keeps original download after media failure", () => {
    render(
      <MemoryRouter>
        <VideoStudio app={makeApp()} version={version} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: en.demo }));
    fireEvent.error(document.querySelector("video")!);
    expect(screen.getByRole("alert").textContent).toBe(en.demoPlaybackError);
    expect(
      screen.getByRole("link", { name: en.download }).getAttribute("href"),
    ).toMatch(/_en\.mp4$/);
  });
  it("does not silently ignore a rejected play request", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("unsupported"));
    render(
      <MemoryRouter>
        <VideoStudio app={makeApp()} version={version} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: en.demo }));
    fireEvent.click(screen.getByRole("button", { name: en.demoPlay }));
    await screen.findByRole("alert");
    expect(screen.getByText(en.demoPlaybackError)).toBeTruthy();
    play.mockRestore();
  });
});
