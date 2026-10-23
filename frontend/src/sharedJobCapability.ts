// Capabilities live only in this tab's JavaScript lifetime. Never persist or log them.
const capabilities = new Map<string, string>();
const parentCapabilities = new Map<string, string>();
export function rememberSharedParent(parentId: string, token: string) {
  parentCapabilities.set(parentId, token);
}
export function rememberSharedJob(jobId: string, token: string) {
  capabilities.set(jobId, token);
}
export function sharedJobRetryBody(jobId: string, parentId?: string | null) {
  const token =
    (parentId ? parentCapabilities.get(parentId) : undefined) ||
    capabilities.get(jobId);
  return token ? { share_token: token } : {};
}
export function inheritSharedJob(previousId: string, nextId: string) {
  const token = capabilities.get(previousId);
  if (token) capabilities.set(nextId, token);
  capabilities.delete(previousId);
}
export function clearSharedJobs() {
  capabilities.clear();
  parentCapabilities.clear();
}
