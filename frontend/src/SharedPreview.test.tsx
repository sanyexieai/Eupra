import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SharedPreview } from "./SharedPreview";
import { clearSharedJobs } from "./sharedJobCapability";
import { api, type Version } from "./api";
vi.mock("./api", () => ({ api: vi.fn(), post: vi.fn() }));
const call = vi.mocked(api);
const original: Version = {
  id: "parent",
  root_version_id: "root",
  parent_version_id: null,
  story_world_id: "world",
  creator_id: "author",
  title: "Shared actual work",
  caption: "Permitted caption",
  image_url: null,
  source_id: null,
  depth: 0,
  remix_allowed: true,
  safety_state: "HOLD",
  demo: true,
  created_at: 1,
};
const own: Version = {
  ...original,
  id: "child",
  parent_version_id: "parent",
  creator_id: "me",
  title: "My completed continuation",
};
const app = () => ({
  t: (k: string) => k,
  locale: "en-US",
  user: { id: "me" } as any,
  setAuth: vi.fn(),
  error: vi.fn(),
  navigate: vi.fn(),
});
beforeEach(() => {
  vi.clearAllMocks();
  clearSharedJobs();
  call.mockImplementation(async (path) =>
    path.startsWith("/share/") ? { version: original } : { items: [own] },
  );
});
afterEach(cleanup);
function mount(a = app(), remember = vi.fn()) {
  render(
    <MemoryRouter>
      <SharedPreview app={a} token="valid-capability" onSharedJob={remember} />
    </MemoryRouter>,
  );
  return { a, remember };
}
describe("permission-bearing original and own child comparison", () => {
  it("shows only the actual owned exact-parent child and routes export to it", async () => {
    call.mockImplementation(async (path) =>
      path.startsWith("/share/")
        ? { version: original }
        : {
            items: [
              own,
              {
                ...own,
                id: "foreign",
                creator_id: "other",
                title: "Foreign child",
              },
              {
                ...own,
                id: "unrelated",
                parent_version_id: "other",
                title: "Unrelated work",
              },
            ],
          },
    );
    mount();
    expect(await screen.findByText("My completed continuation")).toBeTruthy();
    expect(screen.queryByText("Foreign child")).toBeNull();
    expect(screen.queryByText("Unrelated work")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Save or share your version" })
        .getAttribute("href"),
    ).toBe("/share/child");
  });
  it("never invents a child and explains the empty state", async () => {
    call.mockImplementation(async (path) =>
      path.startsWith("/share/") ? { version: original } : { items: [] },
    );
    mount();
    expect(
      await screen.findByText(/No version has been generated for you yet/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Save or share your version" }),
    ).toBeNull();
  });
  it("does not query private works for anonymous visitors", async () => {
    const a = app();
    a.user = null;
    mount(a);
    await screen.findByText("Shared original");
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    expect(a.setAuth).toHaveBeenCalledWith(true);
    expect(call.mock.calls.map((x) => x[0])).toEqual([
      "/share/valid-capability",
    ]);
  });
  it("creates a genuine continuation with capability and remembers only its returned job", async () => {
    call.mockImplementation(async (path) =>
      path === "/generation-jobs"
        ? { id: "real-job" }
        : path.startsWith("/share/")
          ? { version: original }
          : { items: [] },
    );
    const { a, remember } = mount();
    await screen.findByText("Shared original");
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    await waitFor(() =>
      expect(a.navigate).toHaveBeenCalledWith("/jobs/real-job"),
    );
    expect(remember).toHaveBeenCalledWith("real-job", "valid-capability");
    const opts = call.mock.calls.find((x) => x[0] === "/generation-jobs")![1]!;
    expect(JSON.parse(opts.body as string)).toMatchObject({
      parent_version_id: "parent",
      share_token: "valid-capability",
    });
  });
  it("revoked preview fails closed without querying private children", async () => {
    call.mockRejectedValue({ code: "NOT_FOUND" });
    mount();
    await waitFor(() =>
      expect(document.querySelector(".ep-unavailable")).toBeTruthy(),
    );
    expect(screen.queryByText("Shared original")).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("shows recoverable own-list failure without claiming a generated child", async () => {
    call.mockImplementation(async (path) => {
      if (path.startsWith("/share/")) return { version: original };
      throw Error("offline");
    });
    mount();
    expect(
      await screen.findByRole("button", { name: "Reload your versions" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Save or share your version" }),
    ).toBeNull();
  });
});
