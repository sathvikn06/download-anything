import express from 'express';
import dl from 'btch-downloader';
import youtubedl from 'youtube-dl-exec';

import { Readable } from 'stream';
import { spawn } from 'child_process';



function isValidTime(time: string) {
  return /^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(time) || /^\d+(\.\d+)?$/.test(time);
}

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

const app = express();
app.use(express.json());


app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !isValidUrl(url)) return res.status(400).json({ error: 'Invalid URL' });
    let title = 'Media';
    let thumbnail = '';
    let media: any[] = [];

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
       const info = await dl.youtube(url);
       title = info?.title || title;
       thumbnail = info?.thumbnail || thumbnail;
       if (info?.mp4) media.push({ url: info.mp4, type: 'video', thumbnail: info.thumbnail });
    } else if (url.includes('instagram.com')) {
       const info = await dl.igdl(url);
       thumbnail = (info?.result && info.result[0]?.thumbnail) || thumbnail;
       title = 'Instagram Post';
       if (info?.result) {
           media = info.result.map((m: any) => ({
               url: m.url,
               thumbnail: m.thumbnail,
               type: (m.url?.includes('.jpg') || m.url?.includes('.webp')) ? 'image' : 'video'
           }));
       }
    } else if (url.includes('tiktok.com')) {
       const info = await dl.ttdl(url);
       // Check if ttdl is empty
       if (info?.video && info.video.length > 0) {
          title = info?.title || 'TikTok Video';
          thumbnail = info?.thumbnail || thumbnail;
          media.push({ url: info.video[0], type: 'video', thumbnail });
       }
    } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
       const info = await dl.fbdown(url);
       if (info?.Normal_video || info?.HD) {
           title = 'Facebook Video';
           const vidUrl = info.HD || info.Normal_video;
           if (vidUrl) media.push({ url: vidUrl, type: 'video', thumbnail });
       }
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
       const info = await dl.twitter(url);
       if (info?.url) {
           title = 'Twitter/X Video';
           media.push({ url: info.url, type: 'video', thumbnail });
       }
    } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
       try {
         const info = await dl.pinterest(url);
         title = 'Pinterest Media';
         if (info?.result && (info.result as any).url) {
             const isImage = (info.result as any).url.includes('.jpg') || (info.result as any).url.includes('.png');
             media.push({ url: (info.result as any).url, type: isImage ? 'image' : 'video', thumbnail });
         }
       } catch (e) {}
    }

    // fallback to yt-dlp if thumbnail is missing and it's not IG (since IG blocks yt-dlp)
    if (!thumbnail && !url.includes('instagram.com')) {
       try {
           const info = await youtubedl(url, {
              dumpSingleJson: true,
              noCheckCertificates: true,
              noWarnings: true,
           });
           title = (info as any).title || title;
           thumbnail = (info as any).thumbnail || thumbnail;
           if (media.length === 0) {
               media.push({ url: (info as any).url, type: 'video', thumbnail });
           }
       } catch (e: any) {
           console.log("yt-dlp fallback failed:", e.message);
       }
    }

    res.json({ title, thumbnail, media });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

app.get('/api/download', async (req, res) => {
  try {
    const { url, format, quality, direct } = req.query;
    if (!url || typeof url !== 'string' || !isValidUrl(url)) return res.status(400).send('Invalid URL');

    const isInline = req.query.inline === 'true';
    const disposition = isInline ? 'inline' : 'attachment';

    if (direct === 'true') {
        const { start, end } = req.query;
        if (start || end) {
            const fileName = format === 'audio/mp3' ? 'audio.mp3' : format === 'image/jpeg' ? 'image.jpg' : 'download.mp4';
            res.header('Content-Type', format as string);
            res.header('Content-Disposition', `${disposition}; filename="${fileName}"`);
            const ffmpegArgs = [];
            if (start && isValidTime(start as string)) ffmpegArgs.push("-ss", start as string);
            if (end && isValidTime(end as string)) ffmpegArgs.push("-to", end as string);
            ffmpegArgs.push('-i', 'pipe:0');
            if (format === 'video/mp4') {
                ffmpegArgs.push('-c', 'copy');
                ffmpegArgs.push('-movflags', 'frag_keyframe+empty_moov');
                ffmpegArgs.push('-f', 'mp4');
            } else if (format === 'audio/mp3') {
                ffmpegArgs.push('-c:a', 'libmp3lame');
                ffmpegArgs.push('-f', 'mp3');
            }
            ffmpegArgs.push('pipe:1');
            const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
            ffmpegProc.stderr.on('data', data => console.error('FFmpeg Error:', data.toString()));
            
            try {
                const mediaResponse = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                if (mediaResponse.body) {
                    Readable.fromWeb(mediaResponse.body as any).pipe(ffmpegProc.stdin);
                } else {
                    ffmpegProc.stdin.end();
                }
            } catch (e) {
                console.error("Fetch error:", e);
                ffmpegProc.stdin.end();
            }
            
            ffmpegProc.stdout.pipe(res);
            return;
        }

        const response = await fetch(url);
        if (response.ok && response.body) {
            const fileName = format === 'audio/mp3' ? 'audio.mp3' : format === 'image/jpeg' ? 'image.jpg' : 'download.mp4';
            res.header('Content-Disposition', `${disposition}; filename="${fileName}"`);
            Readable.fromWeb(response.body as any).pipe(res);
            return;
        } else {
            return res.status(500).send('Direct fetch failed');
        }
    }

    let mediaUrl = null;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
       const info = await dl.youtube(url);
       if (format === 'image/jpeg') {
           mediaUrl = info?.thumbnail;
       } else if (info?.mp4 || info?.mp3) {
           mediaUrl = format === 'audio/mp3' ? (info.mp3 || info.mp4) : (info.mp4 || info.mp3);
       }
    } else if (url.includes('instagram.com')) {
       const info = await dl.igdl(url);
       if (info?.result && info.result.length > 0) {
           if (format === 'image/jpeg') {
               mediaUrl = info.result[0].thumbnail || info.result[0].url;
           } else {
               mediaUrl = info.result[0].url;
           }
       }
    } else if (url.includes('tiktok.com')) {
       const info = await dl.ttdl(url);
       if (format === 'image/jpeg') {
           mediaUrl = info?.thumbnail;
       } else {
           if (info?.video && info.video.length > 0) {
               mediaUrl = info.video[0]; // TODO: select audio if format=audio/mp3
           }
           if (format === 'audio/mp3' && info?.audio && info.audio.length > 0) {
               mediaUrl = info.audio[0];
           }
       }
    } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
       if (format !== 'image/jpeg') {
           const info = await dl.fbdown(url);
           mediaUrl = info?.HD || info?.Normal_video;
       }
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
       if (format !== 'image/jpeg') {
           const info = await dl.twitter(url) as any;
           if (info && info.length > 0) {
               mediaUrl = info[0].url;
           }
       }
    } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
       try {
           const info = await dl.pinterest(url);
           if (info?.result && (info.result as any).url) {
               mediaUrl = (info.result as any).url;
           }
       } catch (e) {}
    }

    if (mediaUrl) {
       const { start, end } = req.query;
       if (start || end) {
           const fileName = format === 'audio/mp3' ? 'audio.mp3' : format === 'image/jpeg' ? 'image.jpg' : 'download.mp4';
           res.header('Content-Type', format as string);
           res.header('Content-Disposition', `${disposition}; filename="${fileName}"`);
           const ffmpegArgs = [];
           if (start && isValidTime(start as string)) ffmpegArgs.push("-ss", start as string);
           if (end && isValidTime(end as string)) ffmpegArgs.push("-to", end as string);
           ffmpegArgs.push('-i', 'pipe:0');
           if (format === 'video/mp4') {
               ffmpegArgs.push('-c', 'copy');
               ffmpegArgs.push('-movflags', 'frag_keyframe+empty_moov');
               ffmpegArgs.push('-f', 'mp4');
           } else if (format === 'audio/mp3') {
               ffmpegArgs.push('-c:a', 'libmp3lame');
               ffmpegArgs.push('-f', 'mp3');
           }
           ffmpegArgs.push('pipe:1');
           const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
           ffmpegProc.stderr.on('data', data => console.error('FFmpeg Error:', data.toString()));
           
           try {
               const mediaResponse = await fetch(mediaUrl, {
                   headers: {
                       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                   }
               });
               if (mediaResponse.body) {
                   Readable.fromWeb(mediaResponse.body as any).pipe(ffmpegProc.stdin);
               } else {
                   ffmpegProc.stdin.end();
               }
           } catch (e) {
               console.error("Fetch error:", e);
               ffmpegProc.stdin.end();
           }
           
           ffmpegProc.stdout.pipe(res);
           return;
       }
       // redirect to actual URL
       return res.redirect(mediaUrl);
    }

    // fallback to yt-dlp
    let ytdlFormat = 'best';
    if (format === 'audio/mp3') {
        ytdlFormat = 'bestaudio/best';
    } else if (format === 'image/jpeg') {
        ytdlFormat = 'best[ext=jpg]/best';
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
    
    const fileName = format === 'audio/mp3' ? 'audio.mp3' : format === 'image/jpeg' ? 'image.jpg' : 'download.mp4';
    res.header('Content-Disposition', `${disposition}; filename="${fileName}"`);

    const { start, end } = req.query;
    if (start || end) {
       const info = await youtubedl(url, {
         dumpJson: true,
         format: ytdlFormat,
         noCheckCertificates: true,
         noWarnings: true,
       });
       const directUrl = (info as any).url;
       const fileName = format === 'audio/mp3' ? 'audio.mp3' : format === 'image/jpeg' ? 'image.jpg' : 'download.mp4';
       res.header('Content-Type', format as string);
       res.header('Content-Disposition', `${disposition}; filename="${fileName}"`);
       const ffmpegArgs = [];
       if (start && isValidTime(start as string)) ffmpegArgs.push("-ss", start as string);
       if (end && isValidTime(end as string)) ffmpegArgs.push("-to", end as string);
       ffmpegArgs.push('-i', 'pipe:0');
       if (format === 'video/mp4') {
           ffmpegArgs.push('-c', 'copy');
           ffmpegArgs.push('-movflags', 'frag_keyframe+empty_moov');
           ffmpegArgs.push('-f', 'mp4');
       } else if (format === 'audio/mp3') {
           ffmpegArgs.push('-c:a', 'libmp3lame');
           ffmpegArgs.push('-f', 'mp3');
       }
       ffmpegArgs.push('pipe:1');
       const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
       ffmpegProc.stderr.on('data', data => console.error('FFmpeg Error:', data.toString()));
       
       try {
           const mediaResponse = await fetch(directUrl, {
               headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
           });
           if (mediaResponse.body) {
               Readable.fromWeb(mediaResponse.body as any).pipe(ffmpegProc.stdin);
           } else {
               ffmpegProc.stdin.end();
           }
       } catch (e) {
           console.error("Fetch error:", e);
           ffmpegProc.stdin.end();
       }
       
       ffmpegProc.stdout.pipe(res);
       return;
    }

    const subprocess = youtubedl.exec(url, {
      output: '-',
      format: ytdlFormat,
      noCheckCertificates: true,
      noWarnings: true,
    });

    subprocess.catch(err => {
      console.error('yt-dlp execution error:', err.message);
      if (!res.headersSent) res.status(500).send('Download failed: ' + err.message);
    });

    if (subprocess.stdout) {
      subprocess.stdout.pipe(res);
    }

  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).send('Failed to download: ' + error.message);
  }
});

export default app;
