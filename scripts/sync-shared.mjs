import { cp, mkdir } from "node:fs/promises";
await mkdir("functions/shared", { recursive: true });
await cp("shared", "functions/shared", { recursive: true });
