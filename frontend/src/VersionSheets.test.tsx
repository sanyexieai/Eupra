import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { SourceSheet, LineageSheet } from "./VersionSheets";
import { api } from "./api";
import {
  rememberSharedJob,
  rememberSharedParent,
  sharedJobRetryBody,
  inheritSharedJob,
  clearSharedJobs,
} from "./sharedJobCapability";
vi.mock("./api", () => ({ api: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  clearSharedJobs();
});
it("shows only exact owner input and restores focus on closing", async () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  vi.mocked(api).mockResolvedValue({
    text: "Exact full original input",
    source_url: "/api/v1/uploads/private",
    scope: "own_generation_input",
  });
  const close = vi.fn();
  const r = render(<SourceSheet versionId="v1" locale="en-US" close={close} />);
  expect(await screen.findByText("Exact full original input")).toBeTruthy();
  expect(
    screen.getByAltText("Actual uploaded source").getAttribute("src"),
  ).toBe("/api/v1/uploads/private");
  expect(api).toHaveBeenCalledWith("/versions/v1/source");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  r.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
it("does not substitute ancestor input or sample artwork for continuation absence", async () => {
  vi.mocked(api).mockResolvedValue({
    text: "",
    source_url: null,
    parent_version_id: "parent",
  });
  render(<SourceSheet versionId="child" locale="en-US" close={() => {}} />);
  expect(
    await screen.findByText("No source photo was submitted for this version."),
  ).toBeTruthy();
  expect(
    screen.getByText("No text input was submitted for this version."),
  ).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it("fails closed on inaccessible source and can retry", async () => {
  vi.mocked(api)
    .mockRejectedValueOnce(Error("SOURCE_UNAVAILABLE"))
    .mockResolvedValueOnce({ text: "Recovered source", source_url: null });
  render(<SourceSheet versionId="v1" locale="en-US" close={() => {}} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Recovered source")).toBeTruthy();
});
it("lineage sheet follows exact parents, excludes sibling, and selects actual ancestor", () => {
  const root = {
    id: "root",
    title: "Root",
    parent_version_id: null,
    creator_id: "u1",
  };
  const child = {
    id: "child",
    title: "Child",
    parent_version_id: "root",
    creator_id: "u2",
  };
  const sibling = {
    id: "sibling",
    title: "Sibling",
    parent_version_id: "root",
    creator_id: "u3",
  };
  const select = vi.fn(),
    close = vi.fn();
  render(
    <LineageSheet
      versions={[root, child, sibling] as any}
      references={[]}
      selected="child"
      onSelect={select}
      locale="en-US"
      close={close}
    />,
  );
  expect(screen.queryByText("Sibling")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Root" }));
  expect(select).toHaveBeenCalledWith("root");
  expect(close).toHaveBeenCalledOnce();
});
it("keeps shared retry capability only in memory, transfers once and clears on account exit", () => {
  const local = vi.spyOn(Storage.prototype, "setItem");
  rememberSharedJob("job-a", "secret-preview-token");
  expect(sharedJobRetryBody("job-a")).toEqual({
    share_token: "secret-preview-token",
  });
  expect(sharedJobRetryBody("other")).toEqual({});
  inheritSharedJob("job-a", "job-b");
  expect(sharedJobRetryBody("job-a")).toEqual({});
  expect(sharedJobRetryBody("job-b")).toEqual({
    share_token: "secret-preview-token",
  });
  clearSharedJobs();
  expect(sharedJobRetryBody("job-b")).toEqual({});
  expect(local).not.toHaveBeenCalled();
  local.mockRestore();
});

it("recovers a refreshed job only after reopening its exact authorized parent preview", () => {
  clearSharedJobs();
  expect(sharedJobRetryBody("restored-job", "parent-a")).toEqual({});
  rememberSharedParent("parent-a", "active-preview");
  expect(sharedJobRetryBody("restored-job", "parent-a")).toEqual({
    share_token: "active-preview",
  });
  expect(sharedJobRetryBody("restored-job", "parent-b")).toEqual({});
  expect(sharedJobRetryBody("restored-job")).toEqual({});
  expect(sharedJobRetryBody("restored-job", null)).toEqual({});
  rememberSharedJob("restored-job", "stale-job-capability");
  rememberSharedParent("parent-a", "new-active-preview");
  expect(sharedJobRetryBody("restored-job", "parent-a")).toEqual({
    share_token: "new-active-preview",
  });
  clearSharedJobs();
  expect(sharedJobRetryBody("restored-job", "parent-a")).toEqual({});
});
