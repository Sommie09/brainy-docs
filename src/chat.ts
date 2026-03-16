import readline from "readline";
import { Pinecone } from "@pinecone-database/pinecone";
import { openai, embedText } from "./utils.js";
import dotenv from "dotenv";
dotenv.config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

const index = pinecone.index(process.env.PINECONE_INDEX!);

async function askQuestion(question: string): Promise<string> {

  const questionEmbedding = await embedText(question);

  const results = await index.query({
    vector: questionEmbedding,
    topK: 4,
    includeMetadata: true
  });

  const context = results.matches
    .map(match => match.metadata?.text as string)
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!context) {
    return "No relevant content found in the document.";
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Answer questions using ONLY the provided document context. If the answer is not present, say you don't know."
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ]
  });

  return completion.choices[0]?.message.content ?? "No response generated.";

}

async function main() {

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('Document chat ready. Type a question or "exit".\n');

  const ask = () => {

    rl.question("You: ", async input => {

      const question = input.trim();

      if (question.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const answer = await askQuestion(question);

      console.log(`\nAssistant: ${answer}\n`);

      ask();
    });

  };

  ask();
}

main().catch(console.error);