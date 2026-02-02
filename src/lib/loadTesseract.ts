/**
 * Load Tesseract.js from CDN (no npm package needed). Uses createWorker + worker.recognize.
 */
declare global {
  interface Window {
    Tesseract?: {
      createWorker: (
        lang?: string,
        oem?: number,
        options?: { logger?: (m: { status: string; progress?: number }) => void }
      ) => Promise<{
        recognize: (
          image: File | string,
          options?: { logger?: (m: { status: string; progress?: number }) => void }
        ) => Promise<{ data: { text: string } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

const TESSERACT_CDN =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let loaded: Promise<typeof window.Tesseract> | null = null;

export function loadTesseract(): Promise<typeof window.Tesseract> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tesseract only in browser"));
  }
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }
  if (loaded) return loaded;
  loaded = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("Tesseract not on window"));
    };
    script.onerror = () => reject(new Error("Failed to load Tesseract from CDN"));
    document.head.appendChild(script);
  });
  return loaded;
}
