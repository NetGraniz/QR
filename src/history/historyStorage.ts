import type { HistoryEntry } from "../shared/types";

const DB_NAME = "qr-code-studio-history";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const HISTORY_LIMIT = 50;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Не удалось открыть IndexedDB.")));
  });
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = callback(transaction.objectStore(STORE_NAME));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Ошибка IndexedDB.")));
    transaction.addEventListener("complete", () => db.close());
    transaction.addEventListener("abort", () => {
      db.close();
      reject(transaction.error ?? new Error("Операция IndexedDB отменена."));
    });
  });
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  const entries = await withStore<HistoryEntry[]>("readonly", (store) => store.getAll());
  return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  await withStore<IDBValidKey>("readwrite", (store) => store.put(entry));
  const entries = await listHistoryEntries();
  await Promise.all(entries.slice(HISTORY_LIMIT).map((oldEntry) => deleteHistoryEntry(oldEntry.id)));
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.delete(id));
}

export async function clearHistoryEntries(): Promise<void> {
  await withStore<undefined>("readwrite", (store) => store.clear());
}

export async function renameHistoryEntry(id: string, title: string): Promise<void> {
  const entries = await listHistoryEntries();
  const entry = entries.find((item) => item.id === id);
  if (entry) {
    await saveHistoryEntry({ ...entry, title });
  }
}
