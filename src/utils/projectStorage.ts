import { ProjectData } from '../types';

/**
 * Real disk-backed autosave for the current project. Project state used to
 * live only in React memory (App.tsx's useState) — any full page reload
 * (dev server restart, accidental refresh) silently wiped everything,
 * including custom styles and the hero reference, even though ContentFactory
 * correctly wrote them into `project` via onUpdateProject. localStorage was
 * ruled out: a project's base64 reference images (style refs, hero portrait,
 * scene thumbnails) easily blow past its ~5-10MB quota. IndexedDB has no
 * such practical limit for this use case.
 */
const DB_NAME = 'goldflow-studio';
const STORE_NAME = 'project';
const CURRENT_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectToDb(project: ProjectData): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(project, CURRENT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Failed to autosave project:', err);
  }
}

export async function loadProjectFromDb(): Promise<ProjectData | null> {
  try {
    const db = await openDb();
    const result = await new Promise<ProjectData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CURRENT_KEY);
      req.onsuccess = () => resolve((req.result as ProjectData) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch (err) {
    console.warn('Failed to load autosaved project:', err);
    return null;
  }
}
