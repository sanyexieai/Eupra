import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorksPanel } from "./WorksPanel";
import { api, post, type Version } from "./api";
import main from "./locales/en-US.json";
import en from "./locales/works-panel-en-US.json";
import zh from "./locales/works-panel-zh-CN.json";
import dl from "./locales/library-tools-en-US.json";
vi.mock("./api", () => ({ api: vi.fn(), post: vi.fn() }));
const work = {
  id: "v1",
  title: "Owned chapter",
  caption: "Saved caption",
  creator_id: "u1",
  story_world_id: "w1",
  parent_version_id: "p1",
  root_version_id: "r1",
  created_at: 1,
  image_url: null,
  favorite: false,
  demo: true,
} as Version;
const app = () => ({
  locale: "en-US",
  user: { id: "u1" },
  t: (k: keyof typeof main) => main[k],
  setAuth: vi.fn(),
  setNotice: vi.fn(),
  error: vi.fn(),
});
function mount() {
  const a = app();
  render(
    <MemoryRouter>
      <WorksPanel app={a} />
    </MemoryRouter>,
  );
  return a;
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "DELETE") return { ok: true };
    if (path.endsWith("/favorite"))
      return {
        ...work,
        favorite: JSON.parse(options!.body as string).favorite,
      };
    if (path === "/me/works") return { items: [work] };
    if (path === "/me/story-worlds")
      return { items: [{ id: "w1", title: "Owned world" }] };
    if (path === "/me/drafts")
      return {
        items: [
          {
            id: "d1",
            title: "Unfinished idea",
            text: "Draft text",
            updated_at: 2,
          },
        ],
      };
    throw Error(path);
  });
});
afterEach(cleanup);
it("matches locale keys and keeps draft counts out of completed totals", async () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  const old = vi.mocked(api).getMockImplementation()!;
  let removed = false;
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/drafts/d1" && options?.method === "DELETE") removed = true;
    if (path === "/me/drafts" && removed) return { items: [] };
    return old(path, options);
  });
  mount();
  const tab = await screen.findByRole("button", { name: "Drafts" });
  expect(document.querySelector(".library-stats strong")?.textContent).toBe(
    "01",
  );
  fireEvent.click(tab);
  expect(await screen.findByText("Unfinished idea")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: dl.resume }).getAttribute("href"),
  ).toBe("/create?draft=d1");
  fireEvent.click(screen.getByRole("button", { name: dl.move }));
  expect(
    vi.mocked(api).mock.calls.some(([, o]) => o?.method === "DELETE"),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: dl.confirm }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/drafts/d1", { method: "DELETE" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Drafts" }).textContent).toBe(
      "Drafts 0",
    ),
  );
  expect(document.querySelector(".library-stats strong")?.textContent).toBe(
    "01",
  );
});
it("opens accessible drawer and preserves selected lineage, remix and gated share routes", async () => {
  mount();
  const trigger = await screen.findByRole("button", {
    name: en.details + ": " + work.title,
  });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: en.details });
  expect(
    within(dialog).getByRole("link", { name: en.share }).getAttribute("href"),
  ).toBe("/share/v1");
  expect(
    within(dialog)
      .getByRole("link", { name: main.viewWorld })
      .getAttribute("href"),
  ).toBe("/worlds/w1?version=v1");
  expect(
    within(dialog)
      .getByRole("link", { name: main.continueStory })
      .getAttribute("href"),
  ).toBe("/remix/v1?version=v1");
  expect(
    within(dialog)
      .getByRole("link", { name: en.fullDetail })
      .getAttribute("href"),
  ).toBe("/versions/v1");
  fireEvent.click(within(dialog).getByRole("button", { name: main.favorite }));
  await waitFor(() =>
    expect(
      within(dialog)
        .getByRole("button", { name: main.unfavorite })
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
  expect(api).toHaveBeenCalledWith("/versions/v1/favorite", {
    method: "PATCH",
    body: JSON.stringify({ favorite: true }),
  });
  expect(post).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it("preserves search and drafts filter through remount", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Drafts" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "idea" },
  });
  cleanup();
  mount();
  expect(await screen.findByText("Unfinished idea")).toBeTruthy();
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
    "idea",
  );
});
it("does not optimistically favorite when persistence fails", async () => {
  const old = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation((p, o) =>
    p.endsWith("/favorite") ? Promise.reject(Error("offline")) : old(p, o),
  );
  const a = mount();
  fireEvent.click(
    await screen.findByRole("button", { name: en.details + ": " + work.title }),
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: main.favorite }));
  await waitFor(() => expect(a.error).toHaveBeenCalled());
  expect(
    within(dialog)
      .getByRole("button", { name: main.favorite })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});

it("shows a clear draft search empty state", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Drafts" }));
  await screen.findByText("Unfinished idea");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "does not match" },
  });
  expect(await screen.findByText(dl.noMatches)).toBeTruthy();
});
