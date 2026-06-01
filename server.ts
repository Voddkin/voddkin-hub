import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global headers to prevent caching for this highly specific environment
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  // Assets Protection Middleware
  app.use((req, res, next) => {
    // Both dev and prod assets
    if (req.path.includes('/assets/') || req.path.includes('.js') || req.path.includes('.css')) {
      const fetchDest = req.headers['sec-fetch-dest'];
      const referer = req.headers['referer'];
      
      if (fetchDest === 'document' || (!fetchDest && !referer)) {
         return res.status(403).send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Acesso Negado</title>
    <style>
        @font-face { font-family: 'EuropaGrotesk-Medium'; src: url('/assets/fonts/EUROPAGROTESKSH-MED.OTF') format('opentype'); }
        @font-face { font-family: 'EuropaGrotesk-Bold'; src: url('/assets/fonts/EUROPA-GROTESK-SH-BOLD.OTF') format('opentype'); }
        * { cursor: none !important; }
        body, html { margin: 0; padding: 0; width: 100vw; height: 100vh; background: #050505; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; overflow: hidden; }
        .title { font-family: 'EuropaGrotesk-Bold', Courier, monospace; font-size: 3.5rem; font-weight: 700; text-shadow: 0 0 15px rgba(255,255,255,0.4); margin-bottom: 20px; text-transform: uppercase; }
        .subtitle { font-family: 'EuropaGrotesk-Medium', Courier, monospace; font-size: 1.2rem; font-weight: 500; text-shadow: 0 0 10px rgba(255,255,255,0.3); color: rgba(255,255,255,0.8); }
        .custom-cursor { position: fixed; top: 0; left: 0; width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; pointer-events: none; z-index: 99999999; opacity: 1; transform: translate(-50%, -50%); transition: transform 0.1s; }
    </style>
</head>
<body>
    <div class="title">Acesso Negado 403</div>
    <div class="subtitle">Operação Estritamente Proibida</div>
    <div id="custom-cursor" class="custom-cursor"></div>
    <script>
        const cursor = document.getElementById('custom-cursor');
        let cursorX = window.innerWidth / 2;
        let cursorY = window.innerHeight / 2;
        let rawMouseX = cursorX;
        let rawMouseY = cursorY;
        window.addEventListener('mousemove', (e) => {
            rawMouseX = e.clientX;
            rawMouseY = e.clientY;
        });
        function tick() {
            cursorX += (rawMouseX - cursorX) * 0.2;
            cursorY += (rawMouseY - cursorY) * 0.2;
            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    </script>
</body>
</html>`);
      }
    }
    next();
  });

  // Explicit routes for multi-page behavior
  app.get('/extreme', (req, res, next) => {
    req.url = '/extreme.html';
    next();
  });

  app.get('/foxty', (req, res, next) => {
    req.url = '/foxty.html';
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "mpa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/extreme', (req, res) => {
      res.sendFile(path.join(distPath, 'extreme.html'));
    });
    app.get('/foxty', (req, res) => {
      res.sendFile(path.join(distPath, 'foxty.html'));
    });
    app.get('/', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('*', (req, res) => {
      res.status(404).sendFile(path.join(distPath, '404.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
