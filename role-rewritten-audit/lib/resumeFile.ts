"use client";

/**
 * Keeps the uploaded resume file in the visitor's own browser (IndexedDB),
 * so the results page can draw their actual resume with the marks on it.
 * Nothing here is sent to the server. Every call fails quietly: if the
 * browser blocks storage, the results page falls back to the text view.
 */

const DB = "role-rewritten";
const STORE = "resumes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredResume {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

export async function saveResumeFile(id: string, file: File): Promise<void> {
  try {
    const db = await open();
    const bytes = await file.arrayBuffer();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ name: file.name, type: file.type, bytes }, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* storage blocked: results page shows the text view instead */
  }
}

export async function loadResumeFile(id: string): Promise<StoredResume | null> {
  try {
    const db = await open();
    const result = await new Promise<StoredResume | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as StoredResume) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
