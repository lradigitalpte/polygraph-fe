import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

// Crop the EKG waveform (left portion of the 2048x674 logo) and tightly trim it.
// Pass 1: crop the waveform region. Pass 2: trim transparent margins.
// (extract + trim in one pipeline triggers sharp's "bad extract area".)
const cropped = await sharp("public/logo.png")
  .extract({ left: 80, top: 20, width: 680, height: 630 })
  .png()
  .toBuffer();
const wave = await sharp(cropped).trim().png().toBuffer();

async function square(size, out) {
  const inner = await sharp(wave)
    .resize({ width: Math.round(size * 0.82), height: Math.round(size * 0.82), fit: "inside" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(out);
}

await square(512, "src/app/icon.png");
await square(180, "src/app/apple-icon.png");

const bufs = [];
for (const s of [16, 32, 48]) {
  const inner = await sharp(wave)
    .resize({ width: Math.round(s * 0.82), height: Math.round(s * 0.82), fit: "inside" })
    .toBuffer();
  bufs.push(
    await sharp({
      create: { width: s, height: s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .composite([{ input: inner, gravity: "center" }])
      .png()
      .toBuffer()
  );
}
await writeFile("src/app/favicon.ico", await pngToIco(bufs));
console.log("generated icon.png, apple-icon.png, favicon.ico");
