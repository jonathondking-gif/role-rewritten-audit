/**
 * Holds flattened JPEG images of the visitor's resume with the marks drawn
 * on, so the unlock step can email them. Lives in the browser tab only.
 */
const store = new Map<string, string[]>();

export function setMarkedPages(auditId: string, pages: string[]) {
  store.set(auditId, pages);
}

export function getMarkedPages(auditId: string): string[] {
  return store.get(auditId) ?? [];
}
