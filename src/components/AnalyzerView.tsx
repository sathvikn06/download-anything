import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Sparkles, Loader2, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function AnalyzerView() {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      // First, get info
      const infoRes = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await infoRes.json();
      
      const title = data.title || 'Unknown Media';

      // Now analyze
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, text: JSON.stringify({ ...data, media: undefined }) })
      });
      
      const aiData = await aiRes.json();
      if (aiData.error) {
        setAnalysis(`**Error:** ${aiData.error}`);
      } else {
        setAnalysis(aiData.analysis);
      }
    } catch (err: any) {
      console.error(err);
      setAnalysis(`**Error:** Failed to connect to AI Engine.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 mt-10 border-t border-black/10 dark:border-white/10 pt-10">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5" />
        <h2 className="text-xl font-dot tracking-widest uppercase">AI Analyzer</h2>
      </div>
      
      <form onSubmit={handleAnalyze} className="flex gap-2">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Play className="w-4 h-4 text-black/40 dark:text-white/40" />
          </div>
          <input
            type="text"
            placeholder="Paste URL to let AI analyze contents..."
            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-full py-3 pl-11 pr-4 outline-none focus:border-black/30 dark:focus:border-white/30 transition-colors text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isAnalyzing || !url}
          className="bg-black text-white dark:bg-white dark:text-black px-6 rounded-full text-xs font-bold tracking-widest hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 min-w-[120px]"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-3 h-3"/> ANALYZE</>}
        </button>
      </form>

      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 relative">
              <div className="markdown-body prose prose-sm dark:prose-invert">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
