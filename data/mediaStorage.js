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
  const IMAGE_SETTINGS = Object.freeze({
    longestEdge: 1400,
    jpegQuality: 0.75
  });

  class MediaStorageError extends Error {
    constructor(code, message, cause, details = {}) {
      super(message, cause ? { cause } : undefined);
      this.name = "MediaStorageError";
      this.code = code;
      this.details = details;
    }
  }

  let databasePromise = null;
  let databaseConnection = null;
  let mostRecentFailure = null;

  function isDatabaseRequest(value) {
    return typeof IDBRequest !== "undefined" && value instanceof IDBRequest;
  }

  function errorCodeFor(cause) {
    const name = cause?.name;
    if (name === "QuotaExceededError") return "quota-exceeded";
    if (name === "AbortError") return "transaction-aborted";
    if (name === "SecurityError" || name === "NotAllowedError") {
      return "indexeddb-unavailable";
    }
    return "storage-failure";
  }

  function storageError(message, cause, operation = "unknown", details = {}) {
    if (cause instanceof MediaStorageError) {
      cause.details = { ...cause.details, ...details, operation };
      mostRecentFailure = cause;
      return cause;
    }
    const error = new MediaStorageError(
      errorCodeFor(cause),
      message,
      cause,
      {
        ...details,
        operation,
        causeName: cause?.name || null,
        causeMessage: cause?.message || null
      }
    );
    mostRecentFailure = error;
    return error;
  }

  function unavailableError(message, cause) {
    const error = new MediaStorageError(
      "indexeddb-unavailable",
      message,
      cause,
      {
        operation: "open",
        causeName: cause?.name || null,
        causeMessage: cause?.message || null
      }
    );
    mostRecentFailure = error;
    return error;
  }

  function openDatabase() {
    if (!window.indexedDB) {
      return Promise.reject(unavailableError(
        "IndexedDB is not available in this browser."
      ));
    }

    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        reject(unavailableError("IndexedDB could not be opened.", error));
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
        reject(unavailableError("IndexedDB could not be opened.", request.error));
      };

      request.onblocked = () => {
        databasePromise = null;
        reject(unavailableError("IndexedDB is blocked by another open page."));
      };
    });

    return databasePromise;
  }

  async function runTransaction(mode, operation, operationName) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
      let transaction;
      let request;
      let requestError = null;

      try {
        transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        request = operation(store);
        if (isDatabaseRequest(request)) {
          request.addEventListener("error", () => {
            requestError = request.error;
          });
        }
      } catch (error) {
        reject(storageError(
          "The media database transaction could not start.",
          error,
          operationName
        ));
        return;
      }

      transaction.oncomplete = () => resolve(
        isDatabaseRequest(request) ? request.result : request
      );
      transaction.onerror = () => reject(storageError(
        "The media database transaction failed.",
        requestError || transaction.error,
        operationName,
        { transactionMode: mode, stage: "error" }
      ));
      transaction.onabort = () => reject(storageError(
        "The media database transaction was cancelled.",
        requestError || transaction.error || new DOMException(
          "The IndexedDB transaction was aborted.",
          "AbortError"
        ),
        operationName,
        { transactionMode: mode, stage: "abort" }
      ));
    });
  }

  function createMediaId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function put(mediaId, blob) {
    if (!mediaId || !(blob instanceof Blob)) {
      throw storageError(
        "A valid media ID and Blob are required.",
        new TypeError("Expected a non-empty media ID and Blob."),
        "put"
      );
    }
    try {
      await runTransaction(
        "readwrite",
        store => store.put({ mediaId, blob }),
        "put"
      );
    } catch (error) {
      const estimate = await estimateStorage();
      throw storageError(
        "The photo could not be written to the media database.",
        error,
        "put",
        { blobBytes: blob.size, estimate }
      );
    }
    return mediaId;
  }

  async function get(mediaId) {
    if (!mediaId) return null;
    const record = await runTransaction(
      "readonly",
      store => store.get(mediaId),
      "get"
    );
    return record?.blob instanceof Blob ? record.blob : null;
  }

  async function remove(mediaId) {
    if (!mediaId) return;
    await runTransaction("readwrite", store => store.delete(mediaId), "remove");
  }

  async function keys() {
    return (await runTransaction(
      "readonly",
      store => store.getAllKeys(),
      "list-keys"
    )) || [];
  }

  async function records() {
    return (await runTransaction(
      "readonly",
      store => store.getAll(),
      "list-records"
    )) || [];
  }

  async function removeUnreferenced(referencedMediaIds) {
    const referenced = new Set(referencedMediaIds);
    const orphaned = (await keys()).filter(mediaId => !referenced.has(mediaId));
    if (orphaned.length) {
      await runTransaction("readwrite", store => {
        orphaned.forEach(mediaId => store.delete(mediaId));
        return orphaned;
      }, "remove-orphans");
    }
    return orphaned.length;
  }

  async function clearDatabase() {
    await runTransaction("readwrite", store => store.clear(), "clear");
  }

  async function estimateStorage() {
    if (!navigator.storage?.estimate) {
      return { supported: false };
    }
    try {
      const estimate = await navigator.storage.estimate();
      const usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
      const quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
      return {
        supported: true,
        usage,
        quota,
        remaining: usage !== null && quota !== null ? Math.max(0, quota - usage) : null,
        usageRatio: usage !== null && quota ? usage / quota : null,
        usageDetails: estimate.usageDetails || null
      };
    } catch (cause) {
      return {
        supported: true,
        unavailable: true,
        causeName: cause?.name || null,
        causeMessage: cause?.message || null
      };
    }
  }

  async function requestPersistence() {
    if (!navigator.storage?.persisted || !navigator.storage?.persist) {
      return { supported: false, persisted: false };
    }
    try {
      if (await navigator.storage.persisted()) {
        return { supported: true, persisted: true, requested: false };
      }
      return {
        supported: true,
        persisted: await navigator.storage.persist(),
        requested: true
      };
    } catch (cause) {
      return {
        supported: true,
        persisted: false,
        requested: true,
        causeName: cause?.name || null,
        causeMessage: cause?.message || null
      };
    }
  }

  async function audit(referencedMediaIds = []) {
    const savedRecords = await records();
    const savedIds = new Set(savedRecords.map(record => record.mediaId));
    const referenced = new Set(referencedMediaIds);
    const blobSizes = savedRecords.map(record =>
      record.blob instanceof Blob ? record.blob.size : 0
    );
    const totalBlobBytes = blobSizes.reduce((sum, size) => sum + size, 0);
    return {
      recordCount: savedRecords.length,
      totalBlobBytes,
      averageBlobBytes: savedRecords.length ? totalBlobBytes / savedRecords.length : 0,
      smallestBlobBytes: blobSizes.length ? Math.min(...blobSizes) : 0,
      largestBlobBytes: blobSizes.length ? Math.max(...blobSizes) : 0,
      orphanIds: Array.from(savedIds).filter(mediaId => !referenced.has(mediaId)),
      missingIds: Array.from(referenced).filter(mediaId => !savedIds.has(mediaId)),
      estimate: await estimateStorage()
    };
  }

  function diagnoseError(error) {
    const cause = error?.cause;
    return {
      code: typeof error?.code === "string" ? error.code : errorCodeFor(error),
      name: error?.name || null,
      message: error?.message || String(error),
      causeName: error?.details?.causeName || cause?.name || null,
      causeMessage: error?.details?.causeMessage || cause?.message || null,
      operation: error?.details?.operation || null,
      details: error?.details || null
    };
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

  // Keep this path for uncropped image inputs. Quest photos cropped in app.js
  // already have final dimensions and quality, so they bypass this re-encode.
  async function compressImage(file) {
    try {
      const image = await imageFromBlob(file);
      const scale = Math.min(
        1,
        IMAGE_SETTINGS.longestEdge / Math.max(image.naturalWidth, image.naturalHeight)
      );
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
          IMAGE_SETTINGS.jpegQuality
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
    imageSettings: IMAGE_SETTINGS,
    MediaStorageError,
    createMediaId,
    put,
    get,
    remove,
    removeUnreferenced,
    clearDatabase,
    estimateStorage,
    requestPersistence,
    audit,
    diagnoseError,
    lastFailure: () => mostRecentFailure ? diagnoseError(mostRecentFailure) : null,
    compressImage,
    dataUrlToBlob,
    blobFor
  });
})();
