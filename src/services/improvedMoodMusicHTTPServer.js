// 🎵 Verbesserter HTTP Server für OBS Display - Version 2.0
const http = require('http');
const fs = require('fs');
const path = require('path');

class ImprovedMoodMusicHTTPServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.currentData = null;
    this.isRunning = false;
    
    // KORRIGIERT: Zeigt auf das richtige public Verzeichnis (root-level)
    this.publicPath = path.resolve(__dirname, '../../public');
    
    // Sicherstellen, dass das Verzeichnis existiert
    if (!fs.existsSync(this.publicPath)) {
      console.error(`❌ Public Verzeichnis nicht gefunden: ${this.publicPath}`);
      throw new Error('Public directory not found');
    }
    
    console.log(`📁 Serving files from: ${this.publicPath}`);
  }

  async start() {
    if (this.isRunning) {
      console.log(`ℹ️ HTTP Server läuft bereits auf Port ${this.port}`);
      return this.getOBSDisplayURL();
    }

    try {
      await this.findAvailablePort();
      
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      return new Promise((resolve, reject) => {
        this.server.listen(this.port, (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          this.isRunning = true;
          console.log(`🌐 Mood Music HTTP Server erfolgreich gestartet!`);
          console.log(`📱 Server URL: http://localhost:${this.port}`);
          console.log(`🎵 OBS URL: http://localhost:${this.port}/obs-display.html`);
          console.log(`📊 Status URL: http://localhost:${this.port}/status`);
          
          // Erstelle Standard-Daten falls nicht vorhanden
          this.ensureDefaultData();
          
          resolve(this.getOBSDisplayURL());
        });

        this.server.on('error', (error) => {
          this.isRunning = false;
          if (error.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${this.port} belegt, versuche ${this.port + 1}...`);
            this.port += 1;
            setTimeout(() => this.start().then(resolve).catch(reject), 1000);
          } else {
            console.error('❌ HTTP Server Fehler:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Fehler beim Starten des HTTP Servers:', error);
      throw error;
    }
  }

  async findAvailablePort() {
    const { createServer } = require('net');
    
    return new Promise((resolve) => {
      const server = createServer();
      server.listen(this.port, (err) => {
        if (err) {
          this.port += 1;
          server.close();
          resolve(this.findAvailablePort());
        } else {
          server.close();
          resolve(this.port);
        }
      });
    });
  }

  handleRequest(req, res) {
    const url = req.url.split('?')[0];
    const method = req.method;
    
    // CORS Headers für alle Requests
    this.setCORSHeaders(res);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    console.log(`📨 ${method} ${url}`);

    try {
      // API Endpoints
      if (url === '/obs-data.json') {
        this.serveOBSData(res);
        return;
      }

      if (url === '/update-obs-data' && method === 'POST') {
        this.handleOBSDataUpdate(req, res);
        return;
      }

      if (url === '/status') {
        this.serveStatus(res);
        return;
      }

      if (url === '/test') {
        this.serveTestPage(res);
        return;
      }

      // Static file serving
      this.serveStaticFile(url, res);
      
    } catch (error) {
      console.error('❌ Request handling error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  serveOBSData(res) {
    let data = this.currentData;
    
    // Fallback: Lade aus Datei
    if (!data) {
      try {
        const filePath = path.join(this.publicPath, 'obs-data.json');
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          data = JSON.parse(fileContent);
          console.log('📖 OBS Daten aus Datei geladen');
        }
      } catch (error) {
        console.warn('⚠️ Fehler beim Laden der obs-data.json:', error.message);
      }
    }

    // Fallback: Erstelle Demo-Daten
    if (!data) {
      data = this.createDefaultData();
      console.log('🔧 Demo-Daten erstellt');
    }

    // Timestamp aktualisieren
    data.timestamp = Date.now();
    data.serverRunning = true;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
    
    console.log(`✅ OBS Daten gesendet: ${data.song?.title || 'Unbekannt'}`);
  }

  handleOBSDataUpdate(req, res) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        this.currentData = {
          ...data,
          timestamp: Date.now(),
          serverRunning: true
        };
        
        // In Datei speichern
        this.saveDataToFile(this.currentData);
        
        console.log(`🎵 OBS Daten aktualisiert: "${this.currentData.song?.title}" von ${this.currentData.song?.artist}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          timestamp: this.currentData.timestamp,
          song: this.currentData.song?.title
        }));
        
      } catch (error) {
        console.error('❌ Fehler beim Aktualisieren der OBS Daten:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid JSON', 
          details: error.message 
        }));
      }
    });
  }

  serveStatus(res) {
    const status = {
      server: 'Mood Music HTTP Server v2.0',
      running: this.isRunning,
      port: this.port,
      publicPath: this.publicPath,
      timestamp: Date.now(),
      urls: {
        obs: this.getOBSDisplayURL(),
        data: `http://localhost:${this.port}/obs-data.json`,
        test: `http://localhost:${this.port}/test`
      },
      currentSong: this.currentData?.song?.title || 'Kein Song',
      lastUpdate: this.currentData?.timestamp || 'Nie'
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  serveTestPage(res) {
    const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Mood Music HTTP Server Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #1a1a1a; color: white; }
        .status { padding: 20px; background: #2d3748; border-radius: 8px; margin-bottom: 20px; }
        .success { background: #22c55e20; border: 1px solid #22c55e; }
        .error { background: #ef444420; border: 1px solid #ef4444; }
        .data { background: #3b82f620; border: 1px solid #3b82f6; }
        pre { background: #000; padding: 15px; border-radius: 4px; overflow-x: auto; }
        button { padding: 10px 20px; margin: 10px 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #2563eb; }
    </style>
</head>
<body>
    <h1>🎵 Mood Music HTTP Server Test</h1>
    
    <div class="status success">
        <h3>✅ Server läuft erfolgreich!</h3>
        <p>Port: ${this.port}</p>
        <p>Zeit: ${new Date().toLocaleString()}</p>
    </div>

    <div class="status data">
        <h3>📊 Server Status</h3>
        <button onclick="loadStatus()">Status laden</button>
        <button onclick="loadOBSData()">OBS Daten laden</button>
        <button onclick="testOBSPage()">OBS Seite öffnen</button>
        <pre id="output">Klicke auf einen Button...</pre>
    </div>

    <script>
        async function loadStatus() {
            try {
                const response = await fetch('/status');
                const data = await response.json();
                document.getElementById('output').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Fehler: ' + error.message;
            }
        }

        async function loadOBSData() {
            try {
                const response = await fetch('/obs-data.json');
                const data = await response.json();
                document.getElementById('output').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('output').textContent = 'Fehler: ' + error.message;
            }
        }

        function testOBSPage() {
            window.open('/obs-display.html', '_blank');
        }

        // Auto-load status on page load
        window.onload = loadStatus;
    </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(testHTML);
  }

  serveStaticFile(url, res) {
    let filePath;
    
    if (url === '/' || url === '') {
      filePath = path.join(this.publicPath, 'obs-display.html');
    } else {
      // Sicherheitscheck gegen Path Traversal
      const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
      filePath = path.join(this.publicPath, safePath);
    }

    // Sicherheitscheck: Datei muss innerhalb des public Verzeichnisses sein
    if (!filePath.startsWith(this.publicPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden - Path traversal not allowed');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          console.log(`❌ Datei nicht gefunden: ${filePath}`);
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>404 - Datei nicht gefunden</h1>
            <p>Die Datei <code>${url}</code> wurde nicht gefunden.</p>
            <p>Public Verzeichnis: <code>${this.publicPath}</code></p>
            <a href="/test">Server Test-Seite</a>
          `);
        } else {
          console.error(`❌ Dateifehler für ${filePath}:`, err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
        }
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = this.getContentType(ext);
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
      
      console.log(`✅ Datei gesendet: ${path.basename(filePath)} (${contentType})`);
    });
  }

  getContentType(ext) {
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    return contentTypes[ext] || 'text/plain';
  }

  createDefaultData() {
    return {
      song: {
        id: 'server-ready-' + Date.now(),
        title: 'HTTP Server bereit!',
        artist: 'Mood Music System',
        album: 'Server Integration v2.0',
        cover: null
      },
      mood: {
        id: 'server-mode',
        name: 'Connected',
        color: '#22c55e',
        pulseSpeed: 2.0,
        intensity: 'moderate'
      },
      settings: {
        obsAlwaysShow: true,
        obsShowCover: true
      },
      showDisplay: true,
      timestamp: Date.now(),
      serverRunning: true
    };
  }

  ensureDefaultData() {
    if (!this.currentData) {
      this.currentData = this.createDefaultData();
      this.saveDataToFile(this.currentData);
      console.log('📝 Standard-Daten erstellt und gespeichert');
    }
  }

  saveDataToFile(data) {
    try {
      const filePath = path.join(this.publicPath, 'obs-data.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('💾 OBS Daten in Datei gespeichert');
    } catch (error) {
      console.error('❌ Fehler beim Speichern der obs-data.json:', error);
    }
  }

  updateOBSData(data) {
    this.currentData = {
      ...data,
      timestamp: Date.now(),
      serverRunning: true
    };
    
    this.saveDataToFile(this.currentData);
    console.log(`🔄 OBS Daten aktualisiert: "${this.currentData.song?.title}"`);
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server && this.isRunning) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('🛑 HTTP Server gestoppt');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getURL() {
    return `http://localhost:${this.port}`;
  }

  getOBSDisplayURL() {
    return `${this.getURL()}/obs-display.html`;
  }

  getStatusURL() {
    return `${this.getURL()}/status`;
  }

  getTestURL() {
    return `${this.getURL()}/test`;
  }

  isServerRunning() {
    return this.isRunning;
  }
}

// ES-Module Export für React
export default ImprovedMoodMusicHTTPServer;

// CommonJS Export für Node.js (Fallback)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImprovedMoodMusicHTTPServer;
}

// Standalone Ausführung für Testing
if (require.main === module) {
  const server = new ImprovedMoodMusicHTTPServer(8080);
  
  server.start()
    .then((obsURL) => {
      console.log(`\n🎉 Server erfolgreich gestartet!`);
      console.log(`🔗 OBS URL: ${obsURL}`);
      console.log(`🧪 Test URL: ${server.getTestURL()}`);
      
      // Demo-Daten nach 5 Sekunden
      setTimeout(() => {
        server.updateOBSData({
          song: {
            id: 'demo-' + Date.now(),
            title: 'Testlied',
            artist: 'Mood Music Demo',
            album: 'HTTP Server Test',
            cover: 'https://via.placeholder.com/300x300/4ade80/ffffff?text=DEMO'
          },
          mood: {
            name: 'Energetic',
            color: '#f59e0b',
            pulseSpeed: 1.5,
            intensity: 'high'
          },
          settings: {
            obsAlwaysShow: true,
            obsShowCover: true
          },
          showDisplay: true
        });
      }, 5000);
    })
    .catch((error) => {
      console.error('❌ Server start failed:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await server.stop();
    process.exit(0);
  });
}
