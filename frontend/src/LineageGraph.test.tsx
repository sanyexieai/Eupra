import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { LineageGraph, ContributionCards, graphLayout } from "./LineageGraph";
import { api, type Version } from "./api";
import zh from "./locales/lineage-zh-CN.json";
import en from "./locales/lineage-en-US.json";
vi.mock("./api", () => ({ api: vi.fn() }));
const root = {
  id: "root",
  root_version_id: "root",
  parent_version_id: null,
  story_world_id: "world",
  creator_id: "a",
  title: "Visible root",
  caption: "",
  image_url: null,
  source_id: null,
  depth: 0,
  remix_allowed: true,
  safety_state: "HOLD",
  demo: true,
  created_at: 1,
} satisfies Version;
const child = (id: string, parent = "root") => ({
  ...root,
  id,
  parent_version_id: parent,
  title: id,
  depth: 1,
});
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("privacy-safe branch relationships", () => {
  it("has matching language keys", () =>
    expect(Object.keys(zh)).toEqual(Object.keys(en)));
  it("draws actual branching edges, never sequential sibling edges", () => {
    const layout = graphLayout(
      [child("b"), child("c"), root, child("d", "b")],
      [],
    );
    expect(layout.edges).toEqual([
      { parent: "root", child: "b" },
      { parent: "root", child: "c" },
      { parent: "b", child: "d" },
    ]);
    expect(layout.edges.some((e) => e.parent === "b" && e.child === "c")).toBe(
      false,
    );
    expect(layout.nodes.find((n) => n.id === "d")!.x).toBeGreaterThan(
      layout.nodes.find((n) => n.id === "b")!.x,
    );
  });
  it("renders restricted ancestors as unclickable IDs without content", () => {
    const onSelect = vi.fn();
    render(
      <LineageGraph
        versions={[child("owned", "hidden-parent")]}
        references={[
          { id: "hidden-parent", access: "private", content_available: false },
        ]}
        selected="owned"
        onSelect={onSelect}
        locale="en-US"
      />,
    );
    expect(screen.getAllByText(/Private ancestor/).length).toBeGreaterThan(0);
    expect(document.querySelector(".lineage-node.private")?.tagName).toBe(
      "DIV",
    );
    expect(document.querySelector(".lineage-node.private img")).toBeNull();
    expect(
      document.querySelector(
        'path[data-parent="hidden-parent"][data-child="owned"]',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /owned/ }));
    expect(onSelect).toHaveBeenCalledWith("owned");
  });
  it("shows only server-recorded contribution roles and no monetary claim", async () => {
    vi.mocked(api).mockResolvedValue({
      root_creator_id: "u1",
      parent_creator_id: "u2",
      current_creator_id: "u3",
      revenue_enabled: false,
    });
    render(
      <ContributionCards versionId="v" locale="en-US" currentUserId="u3" />,
    );
    await screen.findByText("You");
    expect(screen.getByText("u1")).toBeTruthy();
    expect(screen.getByText("u2")).toBeTruthy();
    expect(screen.getByText("u3")).toBeTruthy();
    expect(screen.getByText(/do not imply earnings eligibility/)).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("does not invent contributors when a record is missing or inaccessible", async () => {
    vi.mocked(api).mockResolvedValue({
      record_available: false,
      revenue_enabled: false,
    });
    const view = render(
      <ContributionCards versionId="missing" locale="en-US" />,
    );
    await screen.findByText(
      "No contribution record is available for this version.",
    );
    expect(document.querySelectorAll(".contribution-cards>div").length).toBe(0);
    view.unmount();
    vi.mocked(api).mockRejectedValue(Error("private"));
    render(<ContributionCards versionId="private" locale="en-US" />);
    await screen.findByText(
      "Contribution records are temporarily unavailable.",
    );
    expect(document.querySelectorAll(".contribution-cards>div").length).toBe(0);
  });
});
