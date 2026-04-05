import fsp from 'node:fs/promises';
import path from 'node:path';
import { parentPort, workerData, threadId } from 'node:worker_threads';
import sharp from 'sharp';

function isRafFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.raf';
}

/**
 * 从 RAF 文件中提取嵌入的 JPEG 预览图
 * RAF 文件结构：头部信息 + JPEG 预览图（通常在文件末尾）
 */
async function extractRafPreview(sourcePath) {
  try {
    console.log(`[Worker] Extracting preview from RAF: ${sourcePath}`);
    
    // 读取文件
    const buffer = await fsp.readFile(sourcePath);
    
    // RAF 文件以 "FUJIFILMCCD-RAW " 开头
    const header = buffer.slice(0, 16).toString('ascii');
    if (!header.startsWith('FUJIFILM')) {
      throw new Error('Not a valid Fujifilm RAF file');
    }
    
    console.log(`[Worker] RAF file size: ${buffer.length} bytes`);
    
    // 查找所有 JPEG 图像，选择最大的一个
    const jpegImages = [];
    
    // 扫描整个文件查找 JPEG 标记
    let i = 0;
    while (i < buffer.length - 1) {
      // 查找 JPEG 开始标记 (FFD8)
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
        const start = i;
        
        // 查找对应的结束标记 (FFD9)
        let j = start + 2;
        while (j < buffer.length - 1) {
          // 找到结束标记
          if (buffer[j] === 0xFF && buffer[j + 1] === 0xD9) {
            const size = j + 2 - start;
            if (size > 50000) { // 至少 50KB
              jpegImages.push({ start, end: j + 2, size });
              console.log(`[Worker] Found JPEG at offset ${start}, size: ${size} bytes`);
            }
            i = j + 2;
            break;
          }
          // 跳过 JPEG 标记中的 FF 00 序列
          if (buffer[j] === 0xFF && buffer[j + 1] === 0x00) {
            j += 2;
          } else if (buffer[j] === 0xFF && buffer[j + 1] >= 0xD0 && buffer[j + 1] <= 0xD7) {
            // RSTn 标记，没有长度
            j += 2;
          } else if (buffer[j] === 0xFF && buffer[j + 1] !== 0x00 && buffer[j + 1] !== 0xD9) {
            // 其他标记，跳过长度
            if (j + 3 < buffer.length) {
              const len = (buffer[j + 2] << 8) | buffer[j + 3];
              j += 2 + len;
            } else {
              j++;
            }
          } else {
            j++;
          }
        }
        
        if (j >= buffer.length - 1) {
          i++;
        }
      } else {
        i++;
      }
    }
    
    if (jpegImages.length === 0) {
      throw new Error('No embedded JPEG found in RAF file');
    }
    
    // 选择最大的 JPEG 图像
    jpegImages.sort((a, b) => b.size - a.size);
    const best = jpegImages[0];
    
    // 提取 JPEG 数据
    const jpegBuffer = buffer.slice(best.start, best.end);
    console.log(`[Worker] Selected JPEG preview: ${jpegBuffer.length} bytes (offset: ${best.start})`);
    
    // 验证是否是有效的 JPEG
    if (jpegBuffer[0] !== 0xFF || jpegBuffer[1] !== 0xD8) {
      throw new Error('Invalid JPEG data extracted from RAF');
    }
    
    return jpegBuffer;
  } catch (err) {
    console.error(`[Worker] Failed to extract RAF preview: ${err.message}`);
    throw err;
  }
}

async function generateThumbnail({ sourcePath, outputPath, maxEdge, quality }) {
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  let image;
  let metadata = { width: 0, height: 0 };

  if (isRafFile(sourcePath)) {
    try {
      const jpegBuffer = await extractRafPreview(sourcePath);
      image = sharp(jpegBuffer, { failOn: 'none' });
      metadata = await image.metadata();
    } catch (err) {
      console.error(`[Worker] RAF preview extraction failed: ${err.message}`);
      // RAF 缩略图提取失败，使用默认占位图
      const placeholder = Buffer.from(`
        <svg width="${maxEdge}" height="${maxEdge}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#333"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#666" text-anchor="middle" dominant-baseline="middle">RAF File</text>
        </svg>
      `);
      image = sharp(placeholder, { failOn: 'none' });
      metadata = { width: maxEdge, height: maxEdge };
    }
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
