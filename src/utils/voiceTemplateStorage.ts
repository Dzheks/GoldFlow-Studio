// Voice templates the user builds in the Lumean tab (voice + settings + label).
// Purely local — persisted in a dedicated IndexedDB so the projectStorage schema
// doesn't need a bumped version. Small blobs (a few dozen rows at most), but
// still not localStorage: keeping every persistent client-side state in one
// storage engine (IDB) avoids the "quota exceeded" surprises we already hit
// once with base64 images.
export interface VoiceTemplate {
  id: string;              // local uuid
  name: string;            // user's label ("Раскрывающий закадр", "Тревожный женский", ...)
  voiceId: string;         // ElevenLabs voice_id
  voiceName: string;       // human name at save time (voice can be renamed later)
  langCode: string;
  stability: number;       // 0..1
  similarityBoost: number; // 0..1
  useSpeakerBoost: boolean;
  speed: number;           // 0.5..2
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'goldflow-voice-templates';
const STORE = 'templates';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listVoiceTemplates(): Promise<VoiceTemplate[]> {
  try {
    const db = await openDb();
    const result = await new Promise<VoiceTemplate[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as VoiceTemplate[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveVoiceTemplate(tpl: VoiceTemplate): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(tpl);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteVoiceTemplate(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
