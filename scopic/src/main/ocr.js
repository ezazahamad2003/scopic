// Local OCR helpers for scanned PDFs and image files.
//
// Everything here runs on the user's machine. We ship English traineddata via
// @tesseract.js-data/eng so Tesseract does not download language files at
// runtime. PDFs are rendered page-by-page with pdf.js into an in-memory canvas,
// then recognized by Tesseract.

const fs = require("fs");
const path = require("path");
const os = require("os");

let createWorker = null;
let engData = null;
let canvas = null;
let pdfjsPromise = null;
let cachePath = path.join(os.tmpdir(), "scopic-ocr-cache");

try { ({ createWorker } = require("tesseract.js")); } catch {}
try { engData = require("@tesseract.js-data/eng"); } catch {}
try { canvas = require("@napi-rs/canvas"); } catch {}

function init(userDataDir) {
  cachePath = path.join(userDataDir, "ocr-cache");
  try { fs.mkdirSync(cachePath, { recursive: true }); } catch {}
}

function available() {
  return Boolean(createWorker && engData && canvas);
}

async function loadPdfjs() {
  if (!pdfjsPromise) {
    if (!canvas) throw new Error("Canvas renderer unavailable");
    globalThis.DOMMatrix ||= canvas.DOMMatrix;
    globalThis.DOMPoint ||= canvas.DOMPoint;
    globalThis.DOMRect ||= canvas.DOMRect;
    globalThis.ImageData ||= canvas.ImageData;
    globalThis.Path2D ||= canvas.Path2D;
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}

async function withWorker(fn) {
  if (!available()) throw new Error("Local OCR dependencies unavailable");
  const worker = await createWorker("eng", 1, {
    langPath: engData.langPath,
    gzip: engData.gzip,
    cachePath,
    logger: () => {},
  });
  try {
    return await fn(worker);
  } finally {
    try { await worker.terminate(); } catch {}
  }
}

async function recognizeImage(buffer) {
  return withWorker(async (worker) => {
    const result = await worker.recognize(buffer);
    return (result?.data?.text || "").trim();
  });
}

async function renderPdfPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const target = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = target.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  return target.toBuffer("image/png");
}

async function recognizePdf(buffer, options = {}) {
  if (!available()) throw new Error("Local OCR dependencies unavailable");
  const pdfjs = await loadPdfjs();
  const maxPages = Number(options.maxPages || process.env.SCOPIC_OCR_MAX_PAGES || 100);
  const scale = Number(options.scale || process.env.SCOPIC_OCR_SCALE || 1.8);
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages || 0;
  const limit = Math.min(pageCount, maxPages);
  const pages = [];
  let text = "";

  await withWorker(async (worker) => {
    for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const image = await renderPdfPage(page, scale);
      const result = await worker.recognize(image);
      const pageText = (result?.data?.text || "").trim();
      if (!pageText) continue;
      const start = text.length;
      text += pageText + "\n\n";
      pages.push({ pageNumber, startChar: start, endChar: text.length });
    }
  });

  try { await loadingTask.destroy(); } catch {}
  return {
    text: text.trim(),
    pages,
    pageCount,
    truncated: pageCount > limit,
    parser: pageCount > limit ? `tesseract-ocr:${limit}-of-${pageCount}` : "tesseract-ocr",
  };
}

module.exports = {
  init,
  available,
  recognizeImage,
  recognizePdf,
};
