import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
rmSync(join(root, ".next"), { recursive: true, force: true });
console.log("Removed .next cache");
