import { Profiler } from "react";
import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DraftLibrary } from "./DraftLibrary";
import { api, post } from "./api";
import en from "./locales/library-tools-en-US.json";
import zh from "./locales/library-tools-zh-CN.json";
vi.mock("./api", () => ({ api: vi.fn(), post: vi.fn() }));
const draft = {
  id: "draft1",
  title: "A saved idea",
  text: "Still drafting",
  updated_at: 1000,
};
const work = {
  id: "work1",
  title: "Owned work",
  caption: "Own caption",
  image_url: null,
  created_at: 1000,
};
const app = () => ({
  locale: "en-US",
  user: { id: "u1" },
  setAuth: vi.fn(),
  setNotice: vi.fn(),
});
function mount(onWorksChanged = vi.fn()) {
  render(
    <MemoryRouter>
      <DraftLibrary app={app()} onWorksChanged={onWorksChanged} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: new RegExp(en.title) }));
  return onWorksChanged;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "DELETE") return { ok: true };
    if (path.startsWith("/me/drafts")) return { items: [draft] };
    if (path.startsWith("/me/works")) return { items: [work] };
    throw Error(path);
  });
  vi.mocked(post).mockResolvedValue(work);
});
afterEach(cleanup);
describe("drafts and recoverable trash", () => {
  it("uses aligned localizations and a real draft resume URL", async () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    mount();
    expect(await screen.findByText(draft.title)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: en.resume }).getAttribute("href"),
    ).toBe("/create?draft=draft1");
  });
  it("requires an explicit confirmation before soft deleting a draft", async () => {
    mount();
    await screen.findByText(draft.title);
    fireEvent.click(screen.getByRole("button", { name: en.move }));
    expect(
      vi.mocked(api).mock.calls.some(([, o]) => o?.method === "DELETE"),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: en.confirm }));
    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenCalledWith("/drafts/draft1", {
        method: "DELETE",
      }),
    );
    await waitFor(() => expect(screen.queryByText(draft.title)).toBeNull());
  });
  it("lists both draft and work trash and restores only the selected item", async () => {
    const changed = mount();
    await screen.findByText(draft.title);
    fireEvent.click(screen.getByRole("button", { name: en.trash }));
    await screen.findByText(work.title);
    const row = screen.getByText(work.title).closest("article")!;
    fireEvent.click(row.querySelector("button")!);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/versions/work1/restore"),
    );
    expect(changed).toHaveBeenCalledOnce();
    expect(screen.getByText(draft.title)).toBeTruthy();
  });
  it("does not hide a work or claim success after failed deletion", async () => {
    mount();
    await screen.findByText(draft.title);
    fireEvent.click(screen.getByRole("button", { name: en.manage }));
    await screen.findByText(work.title);
    vi.mocked(api).mockRejectedValue(Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: en.move }));
    fireEvent.click(screen.getByRole("button", { name: en.confirm }));
    await screen.findByRole("alert");
    expect(screen.getByText(work.title)).toBeTruthy();
  });
  it("shows a real loading error rather than an empty draft list", async () => {
    vi.mocked(api).mockRejectedValue(Error("offline"));
    mount();
    await screen.findByRole("alert");
    expect(screen.queryByText(en.emptyDrafts)).toBeNull();
  });
  it("never exposes active-item Restore actions in any trash-tab commit", async () => {
    let finishTrash!: (value: any) => void;
    const commits: {
      tab: string | undefined;
      titles: string[];
      restoreCount: number;
    }[] = [];
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/me/drafts") return { items: [draft] };
      if (path === "/me/works")
        return {
          items: [work, { ...work, id: "work2", title: "Second active work" }],
        };
      if (path === "/me/drafts?state=trash") return { items: [] };
      if (path === "/me/works?state=trash")
        return new Promise((resolve) => {
          finishTrash = resolve;
        });
      throw Error(path);
    });
    render(
      <MemoryRouter>
        <Profiler
          id="library"
          onRender={() => {
            commits.push({
              tab:
                document.querySelector(".dl-tabs button[aria-pressed=true]")
                  ?.textContent || undefined,
              titles: Array.from(document.querySelectorAll(".dl-item h3")).map(
                (n) => n.textContent || "",
              ),
              restoreCount: Array.from(
                document.querySelectorAll(".dl-actions button"),
              ).filter((n) => n.textContent === en.restore).length,
            });
          }}
        >
          <DraftLibrary app={app()} />
        </Profiler>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.title) }));
    await screen.findByText(draft.title);
    fireEvent.click(screen.getByRole("button", { name: en.manage }));
    await screen.findByText("Second active work");
    commits.length = 0;
    fireEvent.click(screen.getByRole("button", { name: en.trash }));
    expect(commits.filter((c) => c.tab === en.trash).length).toBeGreaterThan(0);
    expect(
      commits
        .filter((c) => c.tab === en.trash)
        .every((c) => c.titles.length === 0 && c.restoreCount === 0),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: en.restore })).toBeNull();
    finishTrash({
      items: [{ ...work, id: "trashed", title: "Actually trashed" }],
    });
    await screen.findByText("Actually trashed");
    expect(screen.getAllByRole("button", { name: en.restore }).length).toBe(1);
    expect(screen.queryByText(work.title)).toBeNull();
  });
  it("ignores a late trash response after switching back to manage", async () => {
    let finishTrash!: (value: any) => void;
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/me/drafts") return { items: [] };
      if (path === "/me/works") return { items: [work] };
      if (path === "/me/drafts?state=trash") return { items: [] };
      if (path === "/me/works?state=trash")
        return new Promise((resolve) => {
          finishTrash = resolve;
        });
      throw Error(path);
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: en.trash }));
    fireEvent.click(screen.getByRole("button", { name: en.manage }));
    await screen.findByText(work.title);
    finishTrash({ items: [{ ...work, id: "trashed", title: "Late trash" }] });
    await waitFor(() => expect(screen.queryByText("Late trash")).toBeNull());
    expect(screen.getByText(work.title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.restore })).toBeNull();
  });
});
