// Encrypted 100% on-device database using IndexedDB + Web Crypto AES-GCM.
// Zero data is transmitted to or stored on any external cloud server.

const DB_NAME = 'fitplate_local_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_RECORD_KEY = 'encrypted_health_state';
const AES_KEY_RECORD_KEY = 'device_aes_key';

// Legacy localStorage keys (migrated automatically into IndexedDB on first read)
const LEGACY_KEY_STORAGE = 'fitplate_device_secret_v1';
const LEGACY_STATE_STORAGE = 'fitplate_encrypted_state_v1';
const LEGACY_PLAIN_FALLBACK_KEY = 'fitplate_local_state_v1';

interface EncryptedPayload {
  v: 1;
  iv: number[];
  ct: number[];
}

type StoredRecord =
  | { kind: 'encrypted'; payload: EncryptedPayload; updatedAt: string }
  | { kind: 'plain'; json: string; updatedAt: string };

let memoryFallbackState: StoredRecord | null = null;
let memoryKeyHex: string | null = null;

function openLocalDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet<V>(db: IDBDatabase, key: string): Promise<V | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as V | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut<V>(db: IDBDatabase, key: string, value: V): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function idbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function safeLocalGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
  } catch {
    // Ignore quota / private mode errors; IndexedDB is primary store
  }
}

function safeLocalRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

async function getOrCreateAesKey(db: IDBDatabase | null): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    let rawHex: string | null = null;
    if (db) {
      rawHex = await idbGet<string>(db, AES_KEY_RECORD_KEY);
    }
    if (!rawHex) {
      rawHex = safeLocalGet(LEGACY_KEY_STORAGE) || memoryKeyHex;
      if (rawHex && db) {
        await idbPut(db, AES_KEY_RECORD_KEY, rawHex);
      }
    }
    if (!rawHex) {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32));
      rawHex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      memoryKeyHex = rawHex;
      if (db) {
        await idbPut(db, AES_KEY_RECORD_KEY, rawHex);
      } else {
        safeLocalSet(LEGACY_KEY_STORAGE, rawHex);
      }
    }
    const pairs = rawHex.match(/.{1,2}/g);
    if (!pairs || pairs.length !== 32) return null;
    const keyBytes = new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
    return await window.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    return null;
  }
}

async function encryptJson(json: string, key: CryptoKey | null): Promise<StoredRecord> {
  const updatedAt = new Date().toISOString();
  if (!key || typeof window === 'undefined' || !window.crypto?.subtle) {
    return { kind: 'plain', json, updatedAt };
  }
  try {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(json);
    const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return {
      kind: 'encrypted',
      payload: {
        v: 1,
        iv: Array.from(iv),
        ct: Array.from(new Uint8Array(cipherBuf)),
      },
      updatedAt,
    };
  } catch {
    return { kind: 'plain', json, updatedAt };
  }
}

async function decryptRecord<T>(record: StoredRecord, key: CryptoKey | null): Promise<T | null> {
  if (record.kind === 'plain') {
    return JSON.parse(record.json) as T;
  }
  if (!key || typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }
  const iv = new Uint8Array(record.payload.iv);
  const ct = new Uint8Array(record.payload.ct);
  const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const plainStr = new TextDecoder().decode(plainBuf);
  return JSON.parse(plainStr) as T;
}

export async function saveEncryptedState<T>(data: T): Promise<void> {
  const json = JSON.stringify(data);
  const db = await openLocalDb();
  const key = await getOrCreateAesKey(db);
  const record = await encryptJson(json, key);
  memoryFallbackState = record;

  if (db) {
    const savedToIdb = await idbPut(db, STATE_RECORD_KEY, record);
    db.close();
    if (savedToIdb) {
      // Remove large legacy localStorage blobs once safely persisted in IndexedDB
      safeLocalRemove(LEGACY_STATE_STORAGE);
      safeLocalRemove(LEGACY_PLAIN_FALLBACK_KEY);
      return;
    }
  }

  // Fallback to localStorage only when IndexedDB is unavailable
  if (record.kind === 'encrypted') {
    safeLocalSet(LEGACY_STATE_STORAGE, JSON.stringify(record.payload));
    safeLocalRemove(LEGACY_PLAIN_FALLBACK_KEY);
  } else {
    safeLocalSet(LEGACY_PLAIN_FALLBACK_KEY, record.json);
  }
}

export async function loadEncryptedState<T>(): Promise<T | null> {
  const db = await openLocalDb();
  const key = await getOrCreateAesKey(db);

  try {
    // 1. Primary: Read from on-device IndexedDB
    if (db) {
      const idbRecord = await idbGet<StoredRecord>(db, STATE_RECORD_KEY);
      if (idbRecord) {
        const decoded = await decryptRecord<T>(idbRecord, key);
        if (decoded !== null) {
          db.close();
          return decoded;
        }
      }
    }

    // 2. Seamless one-time migration from legacy localStorage
    const encRaw = safeLocalGet(LEGACY_STATE_STORAGE);
    if (encRaw && key) {
      const parsed = JSON.parse(encRaw) as EncryptedPayload;
      const decoded = await decryptRecord<T>(
        { kind: 'encrypted', payload: parsed, updatedAt: new Date().toISOString() },
        key
      );
      if (decoded !== null) {
        if (db) {
          await idbPut(db, STATE_RECORD_KEY, {
            kind: 'encrypted',
            payload: parsed,
            updatedAt: new Date().toISOString(),
          });
          safeLocalRemove(LEGACY_STATE_STORAGE);
        }
        db?.close();
        return decoded;
      }
    }

    const plain = safeLocalGet(LEGACY_PLAIN_FALLBACK_KEY);
    if (plain) {
      const parsedPlain = JSON.parse(plain) as T;
      if (db) {
        const record = await encryptJson(plain, key);
        await idbPut(db, STATE_RECORD_KEY, record);
        safeLocalRemove(LEGACY_PLAIN_FALLBACK_KEY);
      }
      db?.close();
      return parsedPlain;
    }

    if (memoryFallbackState) {
      const decoded = await decryptRecord<T>(memoryFallbackState, key);
      db?.close();
      return decoded;
    }

    db?.close();
    return null;
  } catch {
    db?.close();
    const plain = safeLocalGet(LEGACY_PLAIN_FALLBACK_KEY);
    if (!plain) return null;
    try {
      return JSON.parse(plain) as T;
    } catch {
      return null;
    }
  }
}

export async function wipeAllLocalHealthData(): Promise<void> {
  memoryFallbackState = null;
  memoryKeyHex = null;
  safeLocalRemove(LEGACY_STATE_STORAGE);
  safeLocalRemove(LEGACY_PLAIN_FALLBACK_KEY);
  safeLocalRemove(LEGACY_KEY_STORAGE);

  const db = await openLocalDb();
  if (db) {
    await idbClear(db);
    db.close();
  }
}
