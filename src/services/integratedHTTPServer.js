// Integrierter HTTP Server für Mood Music - startet automatisch mit der App
// Bedingte Imports für Browser-Kompatibilität
let http, fs, path;
let isNodeJS = false;

try {
  // Prüfe ob wir wirklich in Node.js/Electron sind (nicht nur Browser mit Polyfills)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    http = require('http');
    fs = require('fs');
    path = require('path');
    isNodeJS = true;
    console.log('🌐 HTTP Server: Node.js/Electron-Umgebung erkannt');
  } else {
    console.log('🌐 HTTP Server: Browser-Umgebung erkannt, verwende Fallback-Modus');
  }
} catch (e) {
  // Browser-Umgebung: Module nicht verfügbar
  console.log('🌐 HTTP Server: Browser-Umgebung erkannt, verwende Fallback-Modus');
}

class IntegratedHTTPServer {
  constructor() {
    this.server = null;
    this.port = 8081;
    this.isRunning = false;
    this.currentData = null;
    this.publicPath = null;
    this.isElectron = false;
    
    this.initializePaths();
  }

  initializePaths() {
    // Bestimme den public Pfad basierend auf der Umgebung
    if (isNodeJS && path) {
      if (typeof window !== 'undefined' && window.process && window.process.type) {
        // Electron Environment
        this.isElectron = true;
        this.publicPath = path.join(__dirname, '../../public');
        console.log('📦 Electron-Umgebung: Public path gesetzt');
      } else if (typeof __dirname !== 'undefined') {
        // Node.js Environment  
        this.publicPath = path.join(__dirname, '../../public');
        console.log('📦 Node.js-Umgebung: Public path gesetzt');
      }
    } else {
      // Browser Environment - kann nicht direkt auf Dateisystem zugreifen
      this.publicPath = null;
      console.log('🌐 HTTP Server: Browser-Umgebung erkannt, Server nicht verfügbar');
    }
  }

  async start(port = 8081) {
    if (this.isRunning) {
      console.log(`🌐 HTTP Server bereits auf Port ${this.port} aktiv`);
      return true;
    }

    this.port = port;

    try {
      // Prüfe ob wir in einer Umgebung sind, die HTTP Server unterstützt
      if (!isNodeJS || !http || typeof http.createServer !== 'function') {
        console.log('🌐 HTTP Server in Browser-Umgebung nicht verfügbar, verwende Fallback');
        
        // Browser-Fallback: Simuliere erfolgreichen Server-Start
        this.isRunning = false; // Bleibt false, da kein echter Server läuft
        return false;
      }

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      return new Promise((resolve, reject) => {
        this.server.listen(this.port, (error) => {
          if (error) {
            if (error.code === 'EADDRINUSE') {
              console.log(`⚠️ Port ${this.port} bereits belegt, versuche ${this.port + 1}...`);
              this.port += 1;
              setTimeout(() => {
                this.start(this.port).then(resolve).catch(reject);
              }, 1000);
            } else {
              reject(error);
            }
          } else {
            this.isRunning = true;
            console.log(`🌐 Mood Music HTTP Server gestartet auf http://localhost:${this.port}`);
            console.log(`🎵 OBS URL: http://localhost:${this.port}/obs-display.html`);
            resolve(true);
          }
        });
      });

    } catch (error) {
      console.error('Fehler beim Starten des HTTP Servers:', error);
      return false;
    }
  }

  handleRequest(req, res) {
    // CORS Headers für alle Requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url.split('?')[0];
    
    // Spezielle Endpoints
    if (url === '/obs-data.json') {
      this.serveOBSData(res);
      return;
    }

    if (url === '/update-obs-data' && req.method === 'POST') {
      this.handleOBSDataUpdate(req, res);
      return;
    }

    if (url === '/status') {
      this.serveStatus(res);
      return;
    }

    // Serve static files
    this.serveStaticFile(url, res);
  }

  serveOBSData(res) {
    let data = this.currentData;
    
    // Fallback: Erstelle Default-Daten wenn keine vorhanden
    if (!data) {
      data = {
        song: {
          id: 'http-server-ready',
          title: 'HTTP Server bereit',
          artist: 'Mood Music System',
          album: 'Warte auf ersten Song...',
          cover: null
        },
        mood: {
          name: 'Ready',
          color: '#3b82f6',
          pulseSpeed: 2.0,
          intensity: 'moderate'
        },
        settings: {
          obsAlwaysShow: true,
          obsShowCover: true
        },
        showDisplay: true,
        timestamp: Date.now()
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
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
          timestamp: Date.now()
        };
        
        console.log(`🎵 HTTP Server: Song aktualisiert - ${data.song?.title || 'Unknown'}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          timestamp: this.currentData.timestamp,
          message: 'OBS data updated successfully' 
        }));
      } catch (error) {
        console.error('Fehler beim Aktualisieren der OBS Daten:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
      }
    });
  }

  serveStatus(res) {
    const status = {
      server: 'Mood Music HTTP Server',
      version: '1.0.0',
      port: this.port,
      isRunning: this.isRunning,
      hasData: !!this.currentData,
      currentSong: this.currentData?.song?.title || 'No song playing',
      uptime: process.uptime ? Math.floor(process.uptime()) : 'Unknown',
      timestamp: Date.now()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  serveStaticFile(url, res) {
    if (!this.publicPath || !fs) {
      res.writeHead(500);
      res.end('File system not available in browser environment');
      return;
    }

    let filePath;
    
    if (url === '/' || url === '') {
      filePath = path.join(this.publicPath, 'obs-display.html');
    } else {
      // Sicherheitscheck: Path muss innerhalb des public Verzeichnisses sein
      filePath = path.join(this.publicPath, url);
      if (!filePath.startsWith(this.publicPath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end(`File not found: ${url}`);
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
        return;
      }

      // Content-Type basierend auf Dateiendung
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };

      const contentType = contentTypes[ext] || 'text/plain';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }

  updateOBSData(data) {
    this.currentData = {
      ...data,
      timestamp: Date.now()
    };
    
    // In Browser-Umgebung: Verwende LocalStorage als Fallback
    if (!isNodeJS) {
      try {
        localStorage.setItem('obs-http-server-data', JSON.stringify(this.currentData));
        console.log(`🌐 HTTP Server (Browser-Fallback): Daten in LocalStorage gespeichert - ${data.song?.title || 'Unknown'}`);
      } catch (e) {
        console.warn('⚠️ LocalStorage nicht verfügbar:', e);
      }
      return;
    }
    
    console.log(`🎵 HTTP Server: Daten aktualisiert - ${data.song?.title || 'Unknown'}`);
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
    return this.isRunning ? `http://localhost:${this.port}` : null;
  }

  getOBSDisplayURL() {
    return this.isRunning ? `${this.getURL()}/obs-display.html` : null;
  }

  isServerRunning() {
    return this.isRunning;
  }

  getCurrentData() {
    return this.currentData;
  }

  getPort() {
    return this.port;
  }
}

// Singleton Export
const integratedHTTPServer = new IntegratedHTTPServer();

// Export für verschiedene Umgebungen
if (typeof module !== 'undefined' && module.exports) {
  module.exports = integratedHTTPServer;
}

if (typeof window !== 'undefined') {
  window.integratedHTTPServer = integratedHTTPServer;
}

export default integratedHTTPServer;