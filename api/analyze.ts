import express from 'express';
import { GoogleGenAI } from '@google/genai';


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
    const { url, title, text } = req.body;
    if (typeof url !== "string" || !isValidUrl(url)) return res.status(400).json({ error: "Invalid URL" });
    if (title && typeof title !== "string") return res.status(400).json({ error: "Invalid title" });
    if (text && typeof text !== "string") return res.status(400).json({ error: "Invalid text" });
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Analyze this media content. \nTitle: ${title}\nURL: ${url}\nAdditional context: ${text}\n\nProvide a concise 3-bullet summary of what this media likely contains and its main themes. Format as markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ analysis: response.text });
  } catch (error: any) {
    console.error('Gemini error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze' });
  }
});

export default router;
