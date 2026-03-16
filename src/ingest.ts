import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { Pinecone } from "@pinecone-database/pinecone";
import { chunkText, embedText } from "./utils";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ingest() {
  const pdfPath = path.join(__dirname, "../documents/document.pdf");
  const buffer = fs.readFileSync(pdfPath);

  const result = await pdfParse(buffer);
  const text = result.text;
  console.log(`Extracted ${text.length} characters from PDF.`);

  const chunks = chunkText(text);
  console.log(`Split into ${chunks.length} chunks.`);

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index(process.env.PINECONE_INDEX!);

  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const vectors = await Promise.all(
      batch.map(async (chunk, _j) => {
        const embedding = await embedText(chunk);
        return {
          id: `chunk-${i + _j}`,
          values: embedding,
          metadata: { text: chunk },
        };
      })
    );

    await index.upsert({ records: vectors });
    console.log(`Upserted chunks ${i} to ${i + batch.length - 1}`);
  }

  console.log("Ingestion complete.");
}

ingest().catch(console.error);