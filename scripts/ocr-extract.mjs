import { createWorker } from "tesseract.js";
import fs from "fs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(JSON.stringify({ success: false, error: "File not found" }));
    process.exit(1);
  }

  let worker = null;
  try {
    worker = await createWorker("eng");
    const buffer = fs.readFileSync(filePath);
    const ret = await worker.recognize(buffer);
    await worker.terminate();
    worker = null;
    console.log(JSON.stringify({ success: true, text: ret?.data?.text || "" }));
  } catch (err) {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
    console.log(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
  }
}

main();
