/**
 * Local media persistence for Summer Quest.
 *
 * Quest metadata remains in localStorage. Binary media lives in IndexedDB as
 * `{ mediaId, blob }` records so photos do not consume the localStorage quota.
 */
(() => {
  const DATABASE_NAME = "nyc-summer-quest-media";
  const DATABASE_VERSION = 1;
  const STORE_NAME = "media";

  class MediaStorageError extends Error {
    constructor(code, message, cause) {
      super(message, cause ? { cause } : undefined);
      this.name = "MediaStorageError";
      this.code = code;
    }
  }

  let databasePromise = null;
  let databaseConnection = null;

  function storageError(message, cause) {
    if (cause instanceof MediaStorageError) return cause;
    return new MediaStorageError("storage-failure", message, cause);
  }

  function openDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(new MediaStorageError(
        "indexeddb-unavailable",
        "IndexedDB is not available in this browser."
      ));
    }

    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        reject(new MediaStorageError(
          "indexeddb-unavailable",
          "IndexedDB could not be opened.",
          error
        ));
        return;
      }

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "mediaId" });
        }
      };

      request.onsuccess = () => {
        databaseConnection = request.result;
        databaseConnection.onversionchange = () => {
          databaseConnection?.close();
          databaseConnection = null;
          databasePromise = null;
        };
        resolve(databaseConnection);
      };

      request.onerror = () => {
        databasePromise = null;
        reject(new MediaStorageError(
          "indexeddb-unavailable",
          "IndexedDB could not be opened.",
          request.error
        ));
      };

      request.onblocked = () => {
        databasePromise = null;
        reject(new MediaStorageError(
          "indexeddb-unavailable",
          "IndexedDB is blocked by another open page."
        ));
      };
    });

    return databasePromise;
  }

  async function runTransaction(mode, operation) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      let transaction;
      let result;

      try {
        transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        result = operation(store);
      } catch (error) {
        reject(storageError("The media database transaction could not start.", error));
        return;
      }

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(storageError(
        "The media database transaction failed.",
        transaction.error
      ));
      transaction.onabort = () => reject(storageError(
        "The media database transaction was cancelled.",
        transaction.error
      ));
    });
  }

  function createMediaId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function put(mediaId, blob) {
    if (!mediaId || !(blob instanceof Blob)) {
      throw storageError("A valid media ID and Blob are required.");
    }
    await runTransaction("readwrite", store => store.put({ mediaId, blob }));
    return mediaId;
  }

  async function get(mediaId) {
    if (!mediaId) return null;
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      let request;
      try {
        request = database.transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .get(mediaId);
      } catch (error) {
        reject(storageError("The saved media could not be read.", error));
        return;
      }

      request.onsuccess = () => {
        const record = request.result;
        resolve(record?.blob instanceof Blob ? record.blob : null);
      };
      request.onerror = () => reject(storageError(
        "The saved media could not be read.",
        request.error
      ));
    });
  }

  async function remove(mediaId) {
    if (!mediaId) return;
    await runTransaction("readwrite", store => store.delete(mediaId));
  }

  async function keys() {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      let request;
      try {
        request = database.transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .getAllKeys();
      } catch (error) {
        reject(storageError("Saved media IDs could not be read.", error));
        return;
      }

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(storageError(
        "Saved media IDs could not be read.",
        request.error
      ));
    });
  }

  async function removeUnreferenced(referencedMediaIds) {
    const referenced = new Set(referencedMediaIds);
    const orphaned = (await keys()).filter(mediaId => !referenced.has(mediaId));
    await Promise.all(orphaned.map(remove));
    return orphaned.length;
  }

  async function clearDatabase() {
    await runTransaction("readwrite", store => store.clear());
  }

  function imageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const sourceUrl = URL.createObjectURL(blob);
      const image = new Image();
      const cleanup = () => URL.revokeObjectURL(sourceUrl);
      image.onload = () => {
        cleanup();
        resolve(image);
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("The selected image could not be decoded."));
      };
      image.src = sourceUrl;
    });
  }

  async function compressImage(file) {
    try {
      const image = await imageFromBlob(file);
      const longestEdge = 1400;
      const scale = Math.min(1, longestEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          result => result ? resolve(result) : reject(new Error("JPEG encoding failed.")),
          "image/jpeg",
          0.75
        );
      });
    } catch (cause) {
      const error = new Error("Image compression failed.", { cause });
      error.code = "compression-failure";
      throw error;
    }
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new MediaStorageError(
        "storage-failure",
        "The legacy saved media is not a valid data URL."
      );
    }

    try {
      const commaIndex = dataUrl.indexOf(",");
      const header = dataUrl.slice(5, commaIndex);
      const body = dataUrl.slice(commaIndex + 1);
      const mediaType = header.split(";")[0] || "application/octet-stream";
      const binary = header.includes(";base64")
        ? window.atob(body)
        : decodeURIComponent(body);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mediaType });
    } catch (error) {
      throw storageError("The legacy saved media could not be converted.", error);
    }
  }

  async function blobFor(record) {
    if (!record) return null;
    if (record.mediaId) return get(record.mediaId);
    if (record.dataUrl) return dataUrlToBlob(record.dataUrl);
    return null;
  }

  window.QuestMediaStore = Object.freeze({
    databaseName: DATABASE_NAME,
    storeName: STORE_NAME,
    MediaStorageError,
    createMediaId,
    put,
    get,
    remove,
    removeUnreferenced,
    clearDatabase,
    compressImage,
    dataUrlToBlob,
    blobFor
  });
})();
