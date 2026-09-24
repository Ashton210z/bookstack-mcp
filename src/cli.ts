import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { BookStackClient } from "./bookstack-client.js";

const USAGE = `Usage: bookstack-mcp upload-image --page <id> [--name <name>] [--type gallery|drawio] [<file> | -]

Uploads an image to BookStack's page-content gallery and prints JSON with its
URL and ready-to-paste markdown. Reads <file>, or stdin when it is "-" or
omitted. Uses the same BOOKSTACK_* environment as the server.

The point is that image bytes travel as bytes. From another machine, pipe the
file into the running server's container so its credentials are reused:

  ssh <host> 'docker exec -i bookstack-mcp bookstack-mcp upload-image --page 12 --name diagram' < diagram.png`;

async function readStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Returns the process exit code. */
export async function runUploadImageCli(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      page: { type: "string" },
      name: { type: "string" },
      type: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const page = Number(values.page);
  if (!Number.isInteger(page) || page < 1) {
    console.error("--page <id> is required and must be a page ID.\n\n" + USAGE);
    return 2;
  }
  if (values.type !== undefined && values.type !== "gallery" && values.type !== "drawio") {
    console.error(`--type must be "gallery" or "drawio" (got "${values.type}").`);
    return 2;
  }
  if (positionals.length > 1) {
    console.error("Give at most one file.\n\n" + USAGE);
    return 2;
  }

  const source = positionals[0] ?? "-";
  const fromStdin = source === "-";
  if (fromStdin && process.stdin.isTTY) {
    console.error("No file given and stdin is a terminal — pipe the image in or pass a path.\n\n" + USAGE);
    return 2;
  }
  const bytes = fromStdin ? await readStdin() : new Uint8Array(readFileSync(source));
  const name = values.name ?? (fromStdin ? "" : basename(source).replace(/\.[a-z0-9]+$/i, ""));
  if (!name) {
    console.error("--name is required when reading from stdin.");
    return 2;
  }

  const env = process.env;
  const missing = ["BOOKSTACK_BASE_URL", "BOOKSTACK_TOKEN_ID", "BOOKSTACK_TOKEN_SECRET"].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing environment: ${missing.join(", ")}`);
    return 2;
  }
  const client = new BookStackClient({
    baseUrl: env.BOOKSTACK_BASE_URL!,
    tokenId: env.BOOKSTACK_TOKEN_ID!,
    tokenSecret: env.BOOKSTACK_TOKEN_SECRET!,
    enableWrite: env.BOOKSTACK_ENABLE_WRITE?.toLowerCase() === "true",
    insecureSkipTlsVerify: env.BOOKSTACK_INSECURE_SKIP_TLS_VERIFY?.toLowerCase() === "true",
  });

  const image = await client.uploadImage({
    uploaded_to: page,
    bytes,
    name,
    type: values.type as "gallery" | "drawio" | undefined,
  });
  console.log(JSON.stringify({ ...image, bytes: bytes.length }, null, 2));
  return 0;
}
