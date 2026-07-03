import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, Download, Loader2, PlayCircle, Settings2, ShieldAlert, Layers, Scissors } from 'lucide-react';
import { useHistory } from '../hooks/useStorage';
import { Platform, DownloadFormat, DownloadQuality, DownloadItem } from '../types';

export function DownloaderView() {
  const { addDownload } = useHistory();
  const [urls, setUrls] = useState<string>('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>('video/mp4');
  const [quality, setQuality] = useState<DownloadQuality>('highest');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<DownloadItem[]>([]);

  const handleProcess = async () => {
    if (!urls.trim()) return;
    
    setIsProcessing(true);
    
    // Parse URLs (split by newline for batch processing)
    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    
    // Create download items
    const newDownloads: DownloadItem[] = urlList.map(url => ({
      id: Math.random().toString(36).substring(7),
      url,
      platform: detectPlatform(url),
      format,
      quality,
      status: 'idle',
      progress: 0,
      createdAt: Date.now(),
    }));

    setActiveDownloads(prev => [...newDownloads, ...prev]);
    setUrls('');
    setIsProcessing(false);

    // Process each download
    newDownloads.forEach(startRealDownload);
  };

  const startRealDownload = async (item: DownloadItem) => {
    try {
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'syncing', progress: 20 } : d));
      
      // Step 1: Fetch metadata
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url })
      });
      
      let title = `Media from ${item.platform}`;
      let thumbnail = '';
      if (response.ok) {
        const info = await response.json();
        title = info.title || title;
        thumbnail = info.thumbnail || thumbnail;
      }
      
      setActiveDownloads(prev => prev.map(d => d.id === item.id ? { ...d, status: 'preview', progress: 60, title, thumbnail } : d));

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
    <div className="flex flex-col h-full gap-8">
      {/* Hero Section */}
      <div className="bg-light-surface dark:bg-cm-blue-light rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-light-blue dark:bg-cm-gold" />
        
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Secure Protocol</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="font-heading text-2xl md:text-3xl font-bold">
            Universal Media Extraction
          </h2>
          <button 
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              if (isBulkMode) {
                setUrls(urls.split('\n')[0] || '');
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors w-fit ${isBulkMode ? 'bg-light-blue text-white dark:bg-cm-gold dark:text-cm-blue' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            <Layers className="w-4 h-4" />
            Bulk Mode
          </button>
        </div>
        
        <div className="space-y-4">
          {isBulkMode ? (
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Paste URLs here (one per line for batch processing)..."
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-light-blue dark:focus:ring-cm-gold outline-none transition-all resize-none h-32 placeholder:text-slate-400"
            />
          ) : (
            <input
              type="text"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="Paste a single URL here..."
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-light-blue dark:focus:ring-cm-gold outline-none transition-all placeholder:text-slate-400"
            />
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <select 
                value={format}
                onChange={(e) => setFormat(e.target.value as DownloadFormat)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-light-blue dark:focus:ring-cm-gold outline-none"
              >
                <option value="video/mp4">Video (MP4)</option>
                <option value="audio/mp3">Audio (MP3)</option>
                <option value="image/jpeg">Image (JPG/PNG)</option>
                <option value="media/gallery">All Media (Gallery)</option>
              </select>
              
              <select 
                value={quality}
                onChange={(e) => setQuality(e.target.value as DownloadQuality)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-light-blue dark:focus:ring-cm-gold outline-none"
              >
                <option value="highest">Highest Quality</option>
                <option value="high">High (1080p)</option>
                <option value="medium">Medium (720p)</option>
                <option value="low">Low (480p)</option>
              </select>
            </div>

            <button
              onClick={handleProcess}
              disabled={!urls.trim() || isProcessing}
              className="w-full sm:w-auto bg-light-blue dark:bg-cm-gold text-white dark:text-cm-blue px-8 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span>Extract Media</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Processing Queue */}
      {activeDownloads.length > 0 && (
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Active Operations
          </h3>
          <div className="grid gap-4">
            <AnimatePresence>
              {activeDownloads.map(download => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col gap-4"
                >
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-900 flex flex-shrink-0 items-center justify-center">
                      {download.thumbnail && download.status !== 'preview' ? (
                        <img src={download.thumbnail} alt="Thumbnail" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <PlayCircle className={`w-6 h-6 ${download.status === 'completed' ? 'text-emerald-500' : 'text-light-blue dark:text-cm-gold'}`} />
                      )}
                    </div>
                    
                    <div className="flex-1 w-full min-w-0">
                      <div className="flex justify-between mb-2">
                        <p className="text-sm font-medium truncate pr-4">{download.title || download.url}</p>
                        <span className="text-xs font-bold uppercase text-slate-500">
                          {download.status === 'completed' ? 'Done' : download.status === 'preview' ? 'Ready' : `${Math.round(download.progress)}%`}
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      {download.status !== 'preview' && download.status !== 'completed' && (
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${download.status === 'completed' ? 'bg-emerald-500' : 'bg-light-blue dark:bg-cm-gold'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${download.progress}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {download.status === 'preview' && (
                    <div className="w-full flex flex-col gap-4 mt-2">
                      {download.format === 'media/gallery' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {download.media?.map((m, idx) => (
                            <div key={idx} className="relative group bg-slate-50 dark:bg-slate-900/50 rounded-lg overflow-hidden flex flex-col">
                              {m.type === 'video' ? (
                                <video src={`/api/download?url=${encodeURIComponent(m.url)}&format=video/mp4&direct=true&inline=true`} className="w-full h-32 object-cover" />
                              ) : (
                                <img src={`/api/download?url=${encodeURIComponent(m.url)}&format=image/jpeg&direct=true&inline=true`} alt={`Media ${idx}`} className="w-full h-32 object-cover" />
                              )}
                              <div className="p-2">
                                <button
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = `/api/download?url=${encodeURIComponent(m.url)}&format=${m.type === 'video' ? 'video/mp4' : 'image/jpeg'}&direct=true`;
                                    a.download = '';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  }}
                                  className="w-full bg-light-blue dark:bg-cm-gold text-white dark:text-cm-blue px-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 hover:opacity-90"
                                >
                                  <Download className="w-3 h-3" />
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                          {(!download.media || download.media.length === 0) && (
                            <div className="col-span-full p-4 text-center text-sm text-slate-500">No media found.</div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 flex items-center justify-center w-full">
                          {download.format === 'video/mp4' && (
                            <video src={`/api/download?url=${encodeURIComponent(download.url)}&format=${download.format}&inline=true`} controls className="w-full h-auto max-h-64 rounded" />
                          )}
                          {download.format === 'audio/mp3' && (
                            <audio src={`/api/download?url=${encodeURIComponent(download.url)}&format=${download.format}&inline=true`} controls className="w-full" />
                          )}
                          {download.format === 'image/jpeg' && (
                            <img src={`/api/download?url=${encodeURIComponent(download.url)}&format=${download.format}&inline=true`} alt="Preview" className="w-full h-auto max-h-64 object-contain rounded" />
                          )}
                        </div>
                      )}
                      
                      {download.format !== 'media/gallery' && (
                        <div className="flex flex-col gap-3">
                          {(download.format === 'video/mp4' || download.format === 'audio/mp3') && (
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                              <Scissors className="w-4 h-4 text-slate-500" />
                              <div className="flex-1 flex gap-2 items-center">
                                <input
                                  type="text"
                                  placeholder="Start (00:00:00)"
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-light-blue dark:focus:ring-cm-gold outline-none"
                                  value={download.trimStart || ''}
                                  onChange={e => updateTrim(download.id, 'trimStart', e.target.value)}
                                />
                                <span className="text-slate-400 text-xs font-bold">-</span>
                                <input
                                  type="text"
                                  placeholder="End (00:00:10)"
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-light-blue dark:focus:ring-cm-gold outline-none"
                                  value={download.trimEnd || ''}
                                  onChange={e => updateTrim(download.id, 'trimEnd', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => executeDownload(download)}
                            className="w-full bg-light-blue dark:bg-cm-gold text-white dark:text-cm-blue px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download Now</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
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
