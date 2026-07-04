import express from 'express';
import dl from 'btch-downloader';
import youtubedl from 'youtube-dl-exec';
import { ZipArchive } from 'archiver';



function isValidUrl(string: string) {
  try {
    const newUrl = new URL(string);
    if (newUrl.protocol !== "http:" && newUrl.protocol !== "https:") return false;
    
    // Basic SSRF protection
    const hostname = newUrl.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return false;
    if (hostname.startsWith("169.254.") || hostname.startsWith("10.") || hostname.match(/^192\.168\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
       return false;
    }
    
    return true;
  } catch (err) {
    return false;
  }
}


const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { urls, format, quality } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'Invalid urls array' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="batch_download.zip"');

    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on('error', function(err: any) {
      console.error(err);
      res.status(500).end();
    });

    archive.pipe(res);

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (typeof url !== "string" || !isValidUrl(url)) {
            archive.append("Invalid URL: " + url, { name: "error_" + (i + 1) + ".txt" });
            continue;
        }
        try {
            let mediaUrl = null;
            let extension = format === 'audio/mp3' ? 'mp3' : 'mp4';
            
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
               const info = await dl.youtube(url);
               mediaUrl = format === 'audio/mp3' ? (info?.mp3 || info?.mp4) : (info?.mp4 || info?.mp3);
            } else if (url.includes('instagram.com')) {
               const info = await dl.igdl(url);
               if (info?.result && info.result.length > 0) {
                   mediaUrl = info.result[0].url;
               }
            } else if (url.includes('tiktok.com')) {
               const info = await dl.ttdl(url);
               if (info?.video && info.video.length > 0) {
                   mediaUrl = info.video[0];
               }
            } else if (url.includes('twitter.com') || url.includes('x.com')) {
               const info = await dl.twitter(url) as any;
               if (info && info.length > 0) {
                   mediaUrl = info[0].url;
               }
            }
            
            if (mediaUrl) {
                const response = await fetch(mediaUrl);
                if (response.ok && response.body) {
                    // Node fetch body is a ReadableStream which archiver can append if converted to node stream
                    // the simplest way is to use a buffer for this example or stream it properly.
                    const buffer = Buffer.from(await response.arrayBuffer());
                    archive.append(buffer, { name: `media_${i + 1}.${extension}` });
                }
            } else {
                // yt-dlp fallback for generic URLs
                let ytdlFormat = 'best';
                if (format === 'audio/mp3') {
                    ytdlFormat = 'bestaudio/best';
                } else {
                    if (quality === 'highest') {
                        ytdlFormat = 'bestvideo+bestaudio/best';
                    } else if (quality === 'high') {
                        ytdlFormat = 'best[height<=1080]/best';
                    } else if (quality === 'medium') {
                        ytdlFormat = 'best[height<=720]/best';
                    } else if (quality === 'low') {
                        ytdlFormat = 'best[height<=480]/best';
                    }
                }
                const info = await youtubedl(url, {
                     dumpJson: true,
                     format: ytdlFormat,
                     noCheckCertificates: true,
                     noWarnings: true,
                });
                const directUrl = (info as any).url;
                if (directUrl) {
                    const response = await fetch(directUrl);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        archive.append(buffer, { name: `media_${i + 1}.${extension}` });
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to process URL ${url}:`, e);
            // Append an error file so they know it failed
            archive.append(`Failed to download: ${url}`, { name: `error_${i + 1}.txt` });
        }
    }

    await archive.finalize();
  } catch (error: any) {
    console.error('Batch error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message || 'Batch processing failed' });
  }
});

export default router;
