import { beforeEach, afterEach, it, expect, vi, describe } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
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
});
