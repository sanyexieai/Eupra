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
const profileFixture = {
  user_id: "u1",
  nickname: "",
  bio: "",
  avatar_asset_id: null,
  avatar_url: null,
  updated_at: null,
};
const summaryFixture = {
  profile: profileFixture,
  stats: { worlds: 1, works: 12, versions: 12, drafts: 2, trashed_works: 1 },
  recent_versions: [version],
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
    if (path === "/me/works" || path === "/me/works?state=all")
      return { items: [version] };
    if (path === "/me/creator-summary") return summaryFixture;
    if (path.endsWith("/motion-preference"))
      return { preset: "gentle", custom_text: "", generation_enabled: false };
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
      if (path === "/me/works" || path === "/me/works?state=all")
        return { items: [] };
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
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: en.motionSave,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
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
      call.mock.calls.every(
        ([path]) =>
          path === "/me/video-credits" || path.endsWith("/motion-preference"),
      ),
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

describe("persisted personal settings", () => {
  it("uses authoritative account totals rather than the recent page size", async () => {
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    expect(document.querySelector(".pp-stats")?.textContent).toContain("12");
    expect(document.querySelectorAll(".pp-recent-grid>a")).toHaveLength(1);
  });
  it("saves nickname and bio then renders the returned server profile", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path === "/me/profile"
        ? {
            ...profileFixture,
            nickname: "New name",
            bio: "A new bio",
            updated_at: 1,
          }
        : old(path, options),
    );
    const a = makeApp();
    render(
      <MemoryRouter>
        <ProfileSettings app={a} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.editProfile }));
    fireEvent.change(screen.getByLabelText(en.nickname), {
      target: { value: "New name" },
    });
    fireEvent.change(screen.getByLabelText(en.bio), {
      target: { value: "A new bio" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.saveProfile }));
    await screen.findByRole("heading", { name: "New name" });
    expect(call).toHaveBeenCalledWith("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        nickname: "New name",
        bio: "A new bio",
        avatar_asset_id: null,
      }),
    });
    expect(a.setNotice).toHaveBeenCalledWith(en.profileSaved);
  });
  it("retains the displayed profile when save fails", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) => {
      if (path === "/me/profile") throw Error("offline");
      return old(path, options);
    });
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.editProfile }));
    fireEvent.change(screen.getByLabelText(en.nickname), {
      target: { value: "Unsaved" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.saveProfile }));
    await screen.findByText(en.profileFailed);
    expect(screen.queryByRole("heading", { name: "Unsaved" })).toBeNull();
  });
  it("uploads an avatar before saving its owned asset id", async () => {
    URL.createObjectURL = vi.fn(() => "blob:avatar");
    URL.revokeObjectURL = vi.fn();
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path === "/uploads"
        ? { id: "avatar1" }
        : path === "/me/profile"
          ? {
              ...profileFixture,
              avatar_asset_id: "avatar1",
              avatar_url: "/api/v1/uploads/avatar1",
            }
          : old(path, options),
    );
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.editProfile }));
    fireEvent.change(screen.getByLabelText(en.chooseAvatar), {
      target: {
        files: [new File(["bytes"], "avatar.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: en.saveProfile }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByAltText(en.avatar).getAttribute("src")).toBe(
      "/api/v1/uploads/avatar1",
    );
    const writes = call.mock.calls.filter(([, options]) => options?.method);
    expect(writes[0][0]).toBe("/uploads");
    expect(JSON.parse(writes[1][1]?.body as string).avatar_asset_id).toBe(
      "avatar1",
    );
  });
  it("does not reset locale on visiting Settings and saves only the notification preference", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path === "/me/settings"
        ? {
            locale: "zh-CN",
            default_remix_allowed: false,
            notifications_enabled: options?.method === "PATCH",
          }
        : old(path, options),
    );
    const a = makeApp();
    render(
      <MemoryRouter>
        <ProfileSettings app={a} />
      </MemoryRouter>,
    );
    const toggle = await screen.findByRole("switch", {
      name: en.notifications,
    });
    expect(a.setLocale).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ notifications_enabled: true }),
      }),
    );
    expect(screen.getByText(en.notificationNote)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
  it("loads older and trashed owned appeal choices, excluding foreign works", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path === "/me/appeals"
        ? { items: [] }
        : path === "/me/works?state=all"
          ? {
              items: [
                version,
                { ...version, id: "older", title: "Older owned work" },
                {
                  ...version,
                  id: "trashed",
                  title: "Trashed owned work",
                  deleted_at: 123,
                },
                {
                  ...version,
                  id: "foreign",
                  title: "Foreign work",
                  creator_id: "another-user",
                },
              ],
            }
          : old(path, options),
    );
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.help }));
    expect(
      await screen.findByRole("option", { name: "Older owned work" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Trashed owned work" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Foreign work" })).toBeNull();
    expect(
      screen.getByLabelText(en.appealVersion, { exact: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: en.appealVersion }),
    ).toBeTruthy();
  });
  it("retries failed appeal work loading without falling back to recent works", async () => {
    const old = call.getMockImplementation()!;
    let fail = true;
    call.mockImplementation(async (path, options) => {
      if (path === "/me/appeals") return { items: [] };
      if (path === "/me/works?state=all" && fail) throw Error("offline");
      return old(path, options);
    });
    render(
      <MemoryRouter>
        <ProfileSettings app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.help }));
    expect(await screen.findByText(en.appealWorksError)).toBeTruthy();
    expect(screen.queryByLabelText(en.appealVersion)).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: en.retry }));
    expect(await screen.findByLabelText(en.appealVersion)).toBeTruthy();
  });
  it("saves a local appeal without claiming staff review or export approval", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path === "/me/appeals"
        ? { items: [], processing_enabled: false }
        : old(path, options),
    );
    vi.mocked(post).mockResolvedValue({
      id: "a1",
      status: "pending_local",
      processing_enabled: false,
    });
    const a = makeApp();
    render(
      <MemoryRouter>
        <ProfileSettings app={a} />
      </MemoryRouter>,
    );
    await screen.findByText(version.title);
    fireEvent.click(screen.getByRole("button", { name: en.help }));
    await screen.findByText(en.appealEmpty);
    expect(screen.getByText(en.appealNote)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.appealReason), {
      target: { value: "Please record my concern" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.appealSend }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/me/appeals", {
        version_id: "v1",
        reason: "Please record my concern",
      }),
    );
    expect(a.setNotice).toHaveBeenCalledWith(en.appealSaved);
  });
});

describe("persisted motion and server quota policy", () => {
  it("loads and saves motion for the actual owned source, without generating", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) =>
      path.endsWith("/motion-preference")
        ? {
            preset: "custom",
            custom_text: "Saved motion",
            generation_enabled: false,
          }
        : old(path, options),
    );
    const a = makeApp();
    render(
      <MemoryRouter>
        <VideoStudio app={a} version={version} />
      </MemoryRouter>,
    );
    const input = await screen.findByRole("textbox", { name: en.custom });
    expect((input as HTMLTextAreaElement).value).toBe("Saved motion");
    fireEvent.change(input, { target: { value: "Another motion" } });
    fireEvent.click(screen.getByRole("button", { name: en.motionSave }));
    await waitFor(() =>
      expect(call).toHaveBeenCalledWith("/versions/v1/motion-preference", {
        method: "PATCH",
        body: JSON.stringify({
          preset: "custom",
          custom_text: "Another motion",
        }),
      }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(a.setNotice).toHaveBeenCalledWith(en.motionSaved);
  });
  it("does not save over an unreadable motion preference", async () => {
    const old = call.getMockImplementation()!;
    call.mockImplementation(async (path, options) => {
      if (path.endsWith("/motion-preference")) throw Error("not found");
      return old(path, options);
    });
    render(
      <MemoryRouter>
        <VideoStudio app={makeApp()} version={version} />
      </MemoryRouter>,
    );
    await screen.findByText(en.motionLoadFailed);
    expect(
      (screen.getByRole("button", { name: en.motionSave }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("shows exhaustion and reset metadata only from the server, with zero usable generations", async () => {
    call.mockResolvedValue({
      remaining: 0,
      daily_limit: 2,
      successful_today: 2,
      enabled: false,
      available_now: 0,
      exhausted: true,
      timezone: "UTC",
      next_reset_at: 1800000000,
    });
    render(
      <MemoryRouter>
        <VideoBalance app={makeApp()} />
      </MemoryRouter>,
    );
    await screen.findByText(en.exhausted);
    expect(screen.getByText(en.availableNow + " · 0")).toBeTruthy();
    expect(screen.getByText(en.resetTimezone + " · UTC")).toBeTruthy();
    expect(
      document
        .querySelector(".pp-reset-details time")
        ?.getAttribute("datetime"),
    ).toBe(new Date(1800000000000).toISOString());
    expect(screen.getByText(en.resetPolicyNote)).toBeTruthy();
    expect(
      document.querySelectorAll(".pp-credit-segments .available"),
    ).toHaveLength(0);
  });
});
