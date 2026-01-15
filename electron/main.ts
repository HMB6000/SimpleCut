
import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as fs from 'fs';
import crypto from 'node:crypto';
// @ts-ignore
import ffmpegStatic from 'ffmpeg-static';
// @ts-ignore
import ffmpeg from 'fluent-ffmpeg';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check if we are running in Electron
if (!app) {
  console.error('CRITICAL ERROR: \'app\' is undefined. This script is likely running in Node.js instead of Electron.')
  console.error('Please ensure you are launching this with the electron binary.')
  process.exit(1)
}

// Fix for ffmpeg path in production/dev
// @ts-ignore
let ffmpegPath = ffmpegStatic as string;
if (app.isPackaged) {
  ffmpegPath = path.join(process.resourcesPath, 'ffmpeg.exe');
}
console.log('FFmpeg Path:', ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

// Register custom protocol as privileged for streaming
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

// Handle file open dialog
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'mp3', 'wav'] }]
  })
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

ipcMain.handle('export-video', async (_event: any, { clips, tracks, duration, outputPath, settings }: { clips: any[], tracks: any[], duration: number, outputPath?: string, settings?: { resolution: string, format: string, frameRate: number } }) => {
  const exportSettings = {
    resolution: settings?.resolution || '1920x1080',
    format: settings?.format || 'mp4',
    frameRate: settings?.frameRate || 30
  };

  return new Promise((resolve) => {
    if (!outputPath) {
      const saveResult = dialog.showSaveDialogSync({
        title: 'Export Video',
        defaultPath: `export.${exportSettings.format}`,
        filters: [{ name: `${exportSettings.format.toUpperCase()} Video`, extensions: [exportSettings.format] }]
      });

      if (!saveResult) {
        return resolve({ success: false, message: 'Cancelled' });
      }
      outputPath = saveResult;
    }

    const command = ffmpeg();

    // Helper to find track index (z-index)
    const getTrackIndex = (trackId: string) => tracks.findIndex((t: any) => t.id === trackId);

    const videoClips = clips.filter((c: any) => c.type === 'video');
    const audioClips = clips.filter((c: any) => c.type === 'audio');
    const textClips = clips.filter((c: any) => c.type === 'text');

    // Sort video clips:
    videoClips.sort((a: any, b: any) => {
      const trackA = getTrackIndex(a.trackId);
      const trackB = getTrackIndex(b.trackId);
      if (trackA !== trackB) return trackB - trackA; // Higher index first (Bottom layer)
      return a.offset - b.offset;
    });

    // --- INPUTS ---
    let inputIndex = 0;

    // 1. Video Inputs
    videoClips.forEach((clip: any) => {
      command.input(clip.src);
      if (clip.start > 0) command.inputOptions(`-ss ${clip.start}`);
      if (clip.end - clip.start > 0) command.inputOptions(`-t ${clip.end - clip.start}`);
      clip.inputIdx = inputIndex++;
    });

    // 2. Audio Inputs
    audioClips.forEach((clip: any) => {
      command.input(clip.src);
      if (clip.start > 0) command.inputOptions(`-ss ${clip.start}`);
      if (clip.end - clip.start > 0) command.inputOptions(`-t ${clip.end - clip.start}`);
      clip.inputIdx = inputIndex++;
    });

    // --- FILTER GRAPH ---
    const complexFilter: string[] = [];

    // A. Video Layering
    // Start with black background with selected resolution
    complexFilter.push(`color=c=black:s=${exportSettings.resolution}:d=${duration}[v_base]`);
    let lastV = '[v_base]';

    videoClips.forEach((clip: any, i: number) => {
      const nextV = `[v_layer_${i}]`;
      // Shift timestamp to timeline offset
      const pts = `[${clip.inputIdx}:v]setpts=PTS-STARTPTS+${clip.offset}/TB[v_in_${i}]`;
      complexFilter.push(pts);

      // Overlay
      const clipDuration = clip.end - clip.start;
      const enable = `between(t,${clip.offset},${clip.offset + clipDuration})`;

      complexFilter.push(`${lastV}[v_in_${i}]overlay=x=(W-w)/2:y=(H-h)/2:enable='${enable}':eof_action=pass${nextV}`);
      lastV = nextV;
    });

    // B. Text Overlays
    textClips.forEach((clip: any, i: number) => {
      const nextV = `[v_text_${i}]`;
      const text = clip.content.replace(/:/g, '\\:').replace(/'/g, "'");

      const x = clip.style.left === '50%' ? '(w-text_w)/2' : clip.style.left.replace('px', '');
      const y = clip.style.top === '50%' ? '(h-text_h)/2' : clip.style.top.replace('px', '');
      const fontSize = clip.style.fontSize ? clip.style.fontSize.replace('px', '') : '24';
      const fontColor = clip.style.color || 'white';
      const enable = `between(t,${clip.offset},${clip.offset + (clip.end - clip.start)})`;
      const fontPath = process.platform === 'win32' ? 'C:/Windows/Fonts/arial.ttf' : '/System/Library/Fonts/Helvetica.ttc';

      complexFilter.push(`${lastV}drawtext=text='${text}':fontfile='${fontPath}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:enable='${enable}'${nextV}`);
      lastV = nextV;
    });

    // C. Audio Mixing
    let audioMixInputs = '';
    let audioCount = 0;

    // Video Audio
    videoClips.forEach((clip: any) => {
      const delay = Math.round(clip.offset * 1000);
      const delayedAudio = `[a_v_${clip.inputIdx}]`;
      complexFilter.push(`[${clip.inputIdx}:a]adelay=${delay}|${delay}${delayedAudio}`);
      audioMixInputs += delayedAudio;
      audioCount++;
    });
    // Audio Clips
    audioClips.forEach((clip: any) => {
      const delay = Math.round(clip.offset * 1000);
      const delayedAudio = `[a_a_${clip.inputIdx}]`;
      complexFilter.push(`[${clip.inputIdx}:a]adelay=${delay}|${delay}${delayedAudio}`);
      audioMixInputs += delayedAudio;
      audioCount++;
    });

    if (audioCount > 0) {
      complexFilter.push(`${audioMixInputs}amix=inputs=${audioCount}:duration=first:dropout_transition=2[a_out]`);
    } else {
      complexFilter.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}[a_out]`);
    }

    command
      .complexFilter(complexFilter)
      .outputOptions('-map', lastV)
      .outputOptions('-map', '[a_out]')
      .outputOptions('-r', exportSettings.frameRate.toString())
      .output(outputPath)
      .on('start', (cmdLine: string) => {
        console.log('Spawned Ffmpeg with command: ' + cmdLine);
      })
      .on('end', () => {
        resolve({ success: true, path: outputPath });
      })
      .on('error', (err: any) => {
        console.error('Error:', err);
        resolve({ success: false, message: err.message });
      })
      .run();
  });
});

ipcMain.handle('generate-proxy', async (_event: any, filePath: string) => {
  const proxiesDir = path.join(app.getPath('userData'), 'proxies');
  if (!fs.existsSync(proxiesDir)) {
    fs.mkdirSync(proxiesDir, { recursive: true });
  }

  const fileName = path.basename(filePath);
  const proxyPath = path.join(proxiesDir, `proxy_${fileName}`);

  // Check if proxy already exists
  if (fs.existsSync(proxyPath)) {
    const stat = fs.statSync(proxyPath);
    if (stat.size > 0) {
      return proxyPath;
    }
    // If 0 bytes, delete it and regenerate
    console.log('Found 0-byte proxy, deleting and regenerating:', proxyPath);
    try {
      fs.unlinkSync(proxyPath);
    } catch (e) {
      console.error('Failed to delete 0-byte proxy:', e);
    }
  }

  return new Promise((resolve) => {
    ffmpeg(filePath)
      .outputOptions('-vf', 'scale=-1:720') // Scale to 720p
      .outputOptions('-c:v', 'libx264')
      .outputOptions('-pix_fmt', 'yuv420p') // Ensure web compatibility
      .outputOptions('-c:a', 'aac') // Ensure AAC audio
      .outputOptions('-preset', 'ultrafast') // Fast generation
      .outputOptions('-crf', '28') // Lower quality is fine for proxy
      .outputOptions('-profile:v', 'baseline') // Maximum compatibility
      .outputOptions('-level', '3.0')
      .outputOptions('-movflags', '+faststart') // Move metadata to start for web playback
      .output(proxyPath)
      .on('end', () => {
        resolve(proxyPath);
      })
      .on('error', (err: any, _stdout: string, stderr: string) => {
        console.error('Proxy generation error:', err);
        console.error('ffmpeg stderr:', stderr);
        resolve(filePath); // Fallback to original
      })
      .run();
  });
});

// Queue for thumbnail generation to prevent CPU saturation
interface ThumbnailJob {
  filePath: string;
  duration: number;
  resolve: (value: string[]) => void;
}
const thumbnailQueue: ThumbnailJob[] = [];
let isProcessingThumbnails = false;

const processThumbnailQueue = () => {
  if (isProcessingThumbnails || thumbnailQueue.length === 0) return;

  isProcessingThumbnails = true;
  const job = thumbnailQueue.shift();
  if (!job) {
    isProcessingThumbnails = false;
    return;
  }

  const { filePath, duration, resolve } = job;
  const thumbnailsDir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  const fileHash = crypto.createHash('md5').update(filePath).digest('hex');
  const thumbPrefix = path.join(thumbnailsDir, `thumb_${fileHash}_`);

  // Check if thumbnails exist
  const existingFiles = fs.readdirSync(thumbnailsDir).filter(f => f.startsWith(`thumb_${fileHash}_`) && f.endsWith('.jpg'));
  if (existingFiles.length > 5) { // Simple check, if we have some, assume done
    existingFiles.sort((a, b) => {
      const idxA = parseInt(a.match(/_(\d+)\.jpg$/)?.[1] || '0');
      const idxB = parseInt(b.match(/_(\d+)\.jpg$/)?.[1] || '0');
      return idxA - idxB;
    });
    resolve(existingFiles.map(f => path.join(thumbnailsDir, f)));
    isProcessingThumbnails = false;
    setImmediate(processThumbnailQueue);
    return;
  }

  console.log('Processing thumbnail job for:', filePath);

  let fps = 0.5;
  if (duration > 0) {
    fps = Math.max(0.5, Math.min(2, 20 / duration));
  }

  ffmpeg(filePath)
    .outputOptions('-vf', `fps=${fps},scale=-1:64`)
    .output(`${thumbPrefix}%d.jpg`)
    .on('end', () => {
      const files = fs.readdirSync(thumbnailsDir).filter(f => f.startsWith(`thumb_${fileHash}_`) && f.endsWith('.jpg'));
      files.sort((a, b) => {
        const idxA = parseInt(a.match(/_(\d+)\.jpg$/)?.[1] || '0');
        const idxB = parseInt(b.match(/_(\d+)\.jpg$/)?.[1] || '0');
        return idxA - idxB;
      });
      resolve(files.map(f => path.join(thumbnailsDir, f)));
      isProcessingThumbnails = false;
      setImmediate(processThumbnailQueue);
    })
    .on('error', (err: any) => {
      console.error('Thumbnail generation error:', err);
      resolve([]);
      isProcessingThumbnails = false;
      setImmediate(processThumbnailQueue);
    })
    .run();
};

ipcMain.handle('generate-thumbnails', async (_event, filePath, duration) => {
  return new Promise((resolve) => {
    thumbnailQueue.push({ filePath, duration, resolve });
    processThumbnailQueue();
  });
});

ipcMain.handle('save-project', async (_event: any, projectData: any) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: 'project.vibe',
    filters: [{ name: 'Vibe Project', extensions: ['vibe'] }]
  });

  if (canceled || !filePath) {
    return { success: false, message: 'Cancelled' };
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
    return { success: true, path: filePath };
  } catch (error: any) {
    console.error('Save error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('load-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Vibe Project', extensions: ['vibe'] }]
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    const projectData = JSON.parse(content);
    return { success: true, data: projectData, path: filePaths[0] };
  } catch (error) {
    console.error('Load error:', error);
    return { success: false, message: (error as any).message };
  }
});

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  protocol.handle('media', async (request) => {
    const rawUrl = request.url;
    console.log('Raw media request:', rawUrl);

    try {
      let decodedPath: string;
      try {
        const urlObj = new URL(rawUrl);
        let pathname = urlObj.pathname;

        // Handle percent encoding
        pathname = decodeURIComponent(pathname);

        // If on Windows and hostname is present (e.g. media://c/Users...), treat it as drive letter
        if (process.platform === 'win32' && urlObj.hostname && urlObj.hostname.length === 1) {
          // hostname 'c' + pathname '/Users/...' -> 'c:/Users/...'
          decodedPath = `${urlObj.hostname}:${pathname}`;
        } else {
          decodedPath = pathname;
        }

        // Remove leading slash for Windows Drive paths if it exists (e.g. /C:/User -> C:/User)
        if (process.platform === 'win32' && decodedPath.startsWith('/') && /^\/[a-zA-Z]:/.test(decodedPath)) {
          decodedPath = decodedPath.slice(1);
        }
      } catch (e) {
        console.warn("Failed to parse URL, falling back", e);
        decodedPath = decodeURIComponent(rawUrl.replace('media://', ''));
      }

      // Normalize path separators
      const finalPath = path.normalize(decodedPath);
      console.log('Resolved file path:', finalPath);

      if (!fs.existsSync(finalPath)) {
        console.error('File not found:', finalPath);
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(finalPath);
      const fileSize = stat.size;

      if (fileSize === 0) {
        console.error('File is empty (0 bytes):', finalPath);
        return new Response('File is empty', { status: 404 });
      }

      const range = request.headers.get('Range');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Handle suffix range (e.g., bytes=-100 means last 100 bytes)
        if (parts[0] === "" && parts[1]) {
          const suffixLength = parseInt(parts[1], 10);
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        }

        // Safety check for invalid numbers
        if (isNaN(start)) start = 0;
        if (isNaN(end)) end = fileSize - 1;

        // Cap chunk size to 50MB to enforce streaming and avoid large payloads
        const MAX_CHUNK_SIZE = 50 * 1024 * 1024;
        if (end - start + 1 > MAX_CHUNK_SIZE) {
          end = start + MAX_CHUNK_SIZE - 1;
        }

        if (start >= fileSize || end >= fileSize || start > end) {
          console.error(`Invalid range request: ${range} (parsed: ${start}-${end}) for size ${fileSize}`);
          return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } });
        }

        const chunksize = (end - start) + 1;

        console.log(`Serving range ${start}-${end}/${fileSize} for ${path.basename(finalPath)}`);

        const stream = fs.createReadStream(finalPath, { start, end });

        // Convert Node stream to Web ReadableStream
        const readable = new ReadableStream({
          start(controller) {
            stream.on('data', (chunk) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                // Controller closed, stop stream
                stream.destroy();
              }
            });
            stream.on('end', () => {
              try {
                controller.close();
              } catch (e) { }
            });
            stream.on('error', (err) => {
              try {
                controller.error(err);
              } catch (e) { }
            });
          },
          cancel() {
            stream.destroy();
          }
        });

        return new Response(readable, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString(),
            'Content-Type': 'video/mp4',
          }
        });
      } else {
        console.log(`Serving full file ${fileSize} bytes`);
        const stream = fs.createReadStream(finalPath);
        // Convert Node stream to Web ReadableStream
        const readable = new ReadableStream({
          start(controller) {
            stream.on('data', (chunk) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                stream.destroy();
              }
            });
            stream.on('end', () => {
              try {
                controller.close();
              } catch (e) { }
            });
            stream.on('error', (err) => {
              try {
                controller.error(err);
              } catch (e) { }
            });
          },
          cancel() {
            stream.destroy();
          }
        });

        return new Response(readable, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
          }
        });
      }
    } catch (error) {
      console.error('Media protocol error:', error);
      return new Response('Error serving file', { status: 500 });
    }
  });

  createWindow();
});
