import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Loader2, PlayCircle, Scissors, Grid2x2 } from 'lucide-react';
import { useHistory } from '../hooks/useStorage';
import { Platform, DownloadFormat, DownloadQuality, DownloadItem } from '../types';

export function DownloaderView() {
  const { addDownload } = useHistory();
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<DownloadFormat>('video/mp4');
  const [quality, setQuality] = useState<DownloadQuality>('highest');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<DownloadItem[]>([]);

  const handleProcess = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    
    setIsProcessing(true);
    
    const newItem: DownloadItem = {
      id: Math.random().toString(36).substring(7),
      url: url.trim(),
      platform: detectPlatform(url.trim()),
      format,
      quality,
      status: 'idle',
      progress: 0,
      createdAt: Date.now(),
    };

    setActiveDownloads(prev => [newItem, ...prev]);
    setUrl('');
    setIsProcessing(false);

    startRealDownload(newItem);
  };

  const startRealDownload = async (item: DownloadItem) => {
    try {
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'syncing', progress: 20 } : d));
      
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url })
      });
      
      let title = `Media from ${item.platform}`;
      let thumbnail = '';
      let media: any = undefined;
      if (response.ok) {
        const info = await response.json();
        title = info.title || title;
        thumbnail = info.thumbnail || thumbnail;
        media = info.media;
      }
      
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'preview', progress: 60, title, thumbnail, media } : d));

    } catch (error) {
      console.error('Download error:', error);
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'failed', error: 'Download failed' } : d));
    }
  };

  const updateTrim = (id: string, field: 'trimStart' | 'trimEnd', value: string) => {
    setActiveDownloads(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const executeDownload = (item: DownloadItem) => {
    setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'downloading', progress: 80 } : d));
    let downloadUrl = `/api/download?url=${encodeURIComponent(item.url)}&format=${encodeURIComponent(item.format)}&quality=${encodeURIComponent(item.quality)}`;
    
    if (item.trimStart) {
        downloadUrl += `&start=${encodeURIComponent(item.trimStart)}`;
    }
    if (item.trimEnd) {
        downloadUrl += `&end=${encodeURIComponent(item.trimEnd)}`;
    }
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const completedItem = { 
      ...item, 
      status: 'completed' as const, 
      progress: 100,
      completedAt: Date.now()
    };
    
    setTimeout(() => {
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? completedItem : d));
      addDownload(completedItem);
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-10 w-full relative z-10">
      <form onSubmit={handleProcess} className="relative">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste media link here..."
          className="w-full bg-transparent border-b-2 border-black/20 dark:border-white/20 px-4 py-4 text-xl md:text-2xl focus:border-black dark:focus:border-white outline-none transition-all placeholder:text-black/30 dark:placeholder:text-white/30 font-sans"
          required
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
          <select 
            value={quality}
            onChange={(e) => setQuality(e.target.value as DownloadQuality)}
            className="bg-transparent border-none text-xs font-dot uppercase tracking-widest text-black/60 dark:text-white/60 focus:ring-0 outline-none cursor-pointer hidden sm:block appearance-none pr-4"
          >
            <option value="highest">HQ</option>
            <option value="high">1080P</option>
            <option value="medium">720P</option>
            <option value="low">480P</option>
          </select>
          <select 
            value={format}
            onChange={(e) => setFormat(e.target.value as DownloadFormat)}
            className="bg-transparent border-none text-xs font-dot uppercase tracking-widest text-black/60 dark:text-white/60 focus:ring-0 outline-none cursor-pointer hidden sm:block appearance-none pr-4"
          >
            <option value="video/mp4">MP4</option>
            <option value="audio/mp3">MP3</option>
            <option value="image/jpeg">JPG</option>
            <option value="media/gallery">ALL</option>
          </select>
          <button
            type="submit"
            disabled={!url.trim() || isProcessing}
            className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-medium text-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Grid2x2 className="w-4 h-4" />}
            <span className="font-dot tracking-widest uppercase">PROCESS</span>
          </button>
        </div>
      </form>

      {/* Format Selector Mobile */}
      <div className="flex justify-center sm:hidden">
        <select 
          value={quality}
          onChange={(e) => setQuality(e.target.value as DownloadQuality)}
          className="bg-transparent border-none text-xs font-dot uppercase tracking-widest focus:ring-0 outline-none"
        >
          <option value="highest">HQ</option>
          <option value="high">1080P</option>
          <option value="medium">720P</option>
          <option value="low">480P</option>
        </select>
        <select 
          value={format}
          onChange={(e) => setFormat(e.target.value as DownloadFormat)}
          className="bg-transparent border-none text-xs font-dot uppercase tracking-widest focus:ring-0 outline-none"
        >
          <option value="video/mp4">MP4</option>
          <option value="audio/mp3">MP3</option>
          <option value="image/jpeg">JPG</option>
          <option value="media/gallery">ALL</option>
        </select>
      </div>

      <AnimatePresence>
        {activeDownloads.map(download => (
          <motion.div
            key={download.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="border border-black/10 dark:border-white/10 rounded-2xl p-5 shadow-sm overflow-hidden bg-[#d1d5db]/50 dark:bg-[#111]/50 backdrop-blur-sm relative"
          >
            {/* Minimal line overlay */}
            <div className="absolute top-0 left-8 w-px h-full bg-black/5 dark:bg-white/5 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row gap-5 items-start relative z-10">
              <div className="w-full md:w-32 h-40 md:h-32 border border-black/10 dark:border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden bg-black/5 dark:bg-white/5">
                {download.thumbnail && download.status !== 'preview' ? (
                  <img src={download.thumbnail} alt="Thumbnail" className="w-full h-full object-cover grayscale opacity-80" />
                ) : (
                  <Grid2x2 className={`w-8 h-8 ${download.progress === 100 ? 'text-black dark:text-white' : 'text-black/30 dark:text-white/30'}`} />
                )}
              </div>
              
              <div className="flex-1 w-full min-w-0 flex flex-col justify-center h-full">
                <div className="flex justify-between items-start mb-2 border-b border-black/10 dark:border-white/10 pb-2">
                  <p className="text-sm font-medium line-clamp-1 pr-4">{download.title || download.url}</p>
                  <span className="text-[10px] font-bold font-dot tracking-widest uppercase text-black/50 dark:text-white/50">
                    {download.progress === 100 ? 'DONE' : download.status === 'preview' ? 'READY' : `${Math.round(download.progress)}%`}
                  </span>
                </div>
                
                {download.status !== 'preview' && download.status !== 'completed' && (
                  <div className="h-px w-full bg-black/10 dark:bg-white/10 mt-4 overflow-hidden">
                    <motion.div 
                      className={`h-full ${download.progress === 100 ? 'bg-black dark:bg-white' : 'bg-black dark:bg-white'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${download.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}

                {download.status === 'preview' && (
                  <div className="mt-4 flex flex-col gap-3">
                    {download.format !== 'media/gallery' && (
                      <>
                        {(download.format === 'video/mp4' || download.format === 'audio/mp3') && (
                          <div className="flex items-center gap-3">
                            <Scissors className="w-4 h-4 text-black/50 dark:text-white/50" />
                            <div className="flex-1 flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder="Start (00:10)"
                                className="w-full bg-transparent border-b border-black/20 dark:border-white/20 px-2 py-1 text-xs font-dot focus:border-black dark:focus:border-white outline-none"
                                value={download.trimStart || ''}
                                onChange={e => updateTrim(download.id, 'trimStart', e.target.value)}
                              />
                              <span className="text-black/40">-</span>
                              <input
                                type="text"
                                placeholder="End (00:20)"
                                className="w-full bg-transparent border-b border-black/20 dark:border-white/20 px-2 py-1 text-xs font-dot focus:border-black dark:focus:border-white outline-none"
                                value={download.trimEnd || ''}
                                onChange={e => updateTrim(download.id, 'trimEnd', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => executeDownload(download)}
                          className="w-full border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black px-4 py-2 rounded-full text-xs font-dot tracking-widest uppercase flex items-center justify-center gap-2 transition-all mt-2"
                        >
                          <Download className="w-4 h-4" />
                          CONFIRM DOWNLOAD
                        </button>
                      </>
                    )}

                    {download.format === 'media/gallery' && (
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {download.media?.map((m, idx) => (
                            <div key={idx} className="relative group overflow-hidden flex flex-col border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                              {m.type === 'video' ? (
                                <video src={`/api/download?url=${encodeURIComponent(m.url)}&format=video/mp4&quality=${encodeURIComponent(download.quality)}&direct=true&inline=true`} className="w-full h-24 object-cover grayscale opacity-80" />
                              ) : (
                                <img src={`/api/download?url=${encodeURIComponent(m.url)}&format=image/jpeg&quality=${encodeURIComponent(download.quality)}&direct=true&inline=true`} alt={`Media ${idx}`} className="w-full h-24 object-cover grayscale opacity-80" />
                              )}
                              <button
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = `/api/download?url=${encodeURIComponent(m.url)}&format=${m.type === 'video' ? 'video/mp4' : 'image/jpeg'}&quality=${encodeURIComponent(download.quality)}&direct=true`;
                                  a.download = '';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }}
                                className="absolute bottom-1 right-1 bg-black/60 backdrop-blur text-white p-1.5 rounded-full hover:bg-black"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                       </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function detectPlatform(url: string): Platform {
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
  return 'unknown';
}

