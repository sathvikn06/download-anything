const fs = require('fs');
let c = fs.readFileSync('vite.config.ts', 'utf8');

c = c.replace(/hmr: process\.env\.DISABLE_HMR !== 'true',/g, "hmr: process.env.DISABLE_HMR === 'true' ? false : { clientPort: 443 },");

fs.writeFileSync('vite.config.ts', c);
