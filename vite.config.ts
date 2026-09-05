import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { defineConfig } from "vite";
import { wallpaperEnginePlugin } from "wallpaper-engine/plugin";
import { myProperties } from "./src/properties.ts";

export default defineConfig({
  base: "",
  plugins: [
    wallpaperEnginePlugin({
      title: "Art Shader Wallpaper",
      metadataFile: "metadata.json",
      supportsAudioProcessing: true,
      properties: myProperties,
      projectLink: {
        name: "kuwarp-wallpaper",
      },
    }),
    {
      name: "pride-svgs-to-png",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith("/pride/") && req.url.endsWith(".png")) {
            const svgName = path.basename(req.url, ".png") + ".svg";
            const svgPath = path.join(process.cwd(), "src", "pride", svgName);

            try {
              const pngBuffer = await sharp(svgPath).png().toBuffer();
              res.setHeader("Content-Type", "image/png");
              return res.end(pngBuffer);
            } catch {
              // File not found or failed to process; pass to next middleware
            }
          }
          next();
        });
      },
      async buildStart() {
        // Only run in build mode (skip in dev mode)
        if (this.meta.watchMode) return;

        const inDir = path.join("src", "pride");

        try {
          const entries = await fs.readdir(inDir, { withFileTypes: true });

          for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".svg")) continue;

            const pngFileName = entry.name.replace(/\.svg$/, ".png");
            const inputPath = path.join(inDir, entry.name);

            const pngBuffer = await sharp(inputPath).png().toBuffer();

            this.emitFile({
              type: "asset",
              fileName: `pride/${pngFileName}`,
              source: pngBuffer,
            });
          }
        } catch {
          this.warn(`Could not read SVG directory: ${inDir}`);
        }
      },
    },
  ],
});
