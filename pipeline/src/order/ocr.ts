import { createWorker } from "tesseract.js";

export async function ocrImage(path: string, langs = "eng+kor"): Promise<string> {
  const worker = await createWorker(langs);
  try {
    const { data } = await worker.recognize(path);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
