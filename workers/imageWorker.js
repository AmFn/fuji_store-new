import fsp from 'node:fs/promises';
import path from 'node:path';
import { parentPort, workerData, threadId } from 'node:worker_threads';
import sharp from 'sharp';
import exifr from 'exifr';

function isRafFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.raf';
}

async function generateThumbnail({ sourcePath, outputPath, maxEdge, quality }) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  let image;
  let metadata = { width: 0, height: 0 };

  if (isRafFile(sourcePath)) {
    const embeddedThumb = await exifr.thumbnail(sourcePath).catch(() => null);
    if (!embeddedThumb) {
      throw new Error('RAF thumbnail extraction failed');
    }
    image = sharp(Buffer.from(embeddedThumb), { failOn: 'none' });
    metadata = await image.metadata();
  } else {
    image = sharp(sourcePath, { failOn: 'none' });
    metadata = await image.metadata();
  }

  const tempPath = `${outputPath}.${threadId}.${Date.now()}.tmp`;
  await image
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:4:4',
    })
    .toFile(tempPath);

  // Atomic swap to avoid partial files if app crashes while writing.
  await fsp.rename(tempPath, outputPath);

  return {
    ok: true,
    outputPath,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

generateThumbnail(workerData)
  .then((result) => parentPort.postMessage(result))
  .catch((error) => {
    parentPort.postMessage({
      ok: false,
      error: error.message,
    });
  });
