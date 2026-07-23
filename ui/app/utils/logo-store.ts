const DB_NAME = 'demo-shop-whitelabel';
const DB_VERSION = 1;
const STORE = 'assets';
const LOGO_KEY = 'logo';

type StoredLogo = { type: string; buffer: ArrayBuffer };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function getStoredLogo(): Promise<Blob | null> {
  const stored = (await withStore('readonly', (store) => store.get(LOGO_KEY))) as StoredLogo | undefined;
  if (!stored || !(stored.buffer instanceof ArrayBuffer)) return null;
  return new Blob([stored.buffer], { type: stored.type });
}

export async function putStoredLogo(blob: Blob): Promise<void> {
  const value: StoredLogo = { type: blob.type, buffer: await blob.arrayBuffer() };
  await withStore('readwrite', (store) => store.put(value, LOGO_KEY));
}

export async function deleteStoredLogo(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(LOGO_KEY));
}
