export interface StoredMediaRecord {
  id: string;
  kind: 'music' | 'video';
  name: string;
  sizeLabel: string;
  blob: Blob;
  addedAt: number;
}

const DB_NAME = 'qashqai_v2_media';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveMediaRecords(records: StoredMediaRecord[]): Promise<void> {
  try {
    const db = await openMediaDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    records.forEach((rec) => store.put(rec));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Gracefully fall back to session-only if IndexedDB is restricted
  }
}

export async function loadMediaRecords(): Promise<StoredMediaRecord[]> {
  try {
    const db = await openMediaDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const items = await new Promise<StoredMediaRecord[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as StoredMediaRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

export async function deleteMediaRecord(id: string): Promise<void> {
  try {
    const db = await openMediaDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}
