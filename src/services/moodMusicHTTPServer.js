// Einfacher HTTP Server für OBS Display - löst CORS-Probleme
const http = require('http');
const fs = require('fs');
const path = require('path');

class MoodMusicHTTPServer {
  constructor(port = 8081) {
    this.port = port;
    this.server = null;
    this.currentData = null;
    this.publicPath = path.join(__dirname, '../public');
  }

  start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      console.log(`🌐 Mood Music HTTP Server läuft auf http://localhost:${this.port}`);
      console.log(`📁 Serving files from: ${this.publicPath}`);
      console.log(`🎵 OBS URL: http://localhost:${this.port}/obs-display.html`);
    });

    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${this.port} ist bereits belegt. Versuche Port ${this.port + 1}...`);
        this.port += 1;
        setTimeout(() => this.start(), 1000);
      } else {
        console.error('HTTP Server Fehler:', error);
      }
    });
  }

  handleRequest(req, res) {
    let filePath;
    
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

    // Parse URL
    const url = req.url.split('?')[0]; // Remove query params
    
    // Special endpoints
    if (url === '/obs-data.json') {
      this.serveOBSData(res);
      return;
    }

    if (url === '/update-obs-data' && req.method === 'POST') {
      this.handleOBSDataUpdate(req, res);
      return;
    }

    // Serve static files
    if (url === '/' || url === '') {
      filePath = path.join(this.publicPath, 'obs-display.html');
    } else {
      filePath = path.join(this.publicPath, url);
    }

    this.serveStaticFile(filePath, res);
  }

  serveOBSData(res) {
    // Versuche aktuellste Daten aus verschiedenen Quellen
    let data = this.currentData;
    
    // Fallback: Lade aus obs-data.json Datei
    if (!data) {
      try {
        const filePath = path.join(this.publicPath, 'obs-data.json');
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } catch (error) {
        console.log('Keine obs-data.json gefunden, erstelle Beispieldaten...');
      }
    }

    // Fallback: Erstelle Beispieldaten
    if (!data) {
      data = {
        song: {
          id: 'waiting-001',
          title: 'Warte auf Song...',
          artist: 'Mood Music System',
          album: 'HTTP Server bereit',
          cover: null
        },
        mood: {
          name: 'Standby',
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
        this.currentData = data;
        
        // Auch in Datei speichern
        const filePath = path.join(this.publicPath, 'obs-data.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        console.log(`🎵 OBS Daten aktualisiert: ${data.song?.title || 'Unknown'}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      } catch (error) {
        console.error('Fehler beim Aktualisieren der OBS Daten:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  serveStaticFile(filePath, res) {
    // Sicherheitscheck: Path muss innerhalb des public Verzeichnisses sein
    if (!filePath.startsWith(this.publicPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
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
    
    // Auch in Datei speichern für Persistenz
    try {
      const filePath = path.join(this.publicPath, 'obs-data.json');
      fs.writeFileSync(filePath, JSON.stringify(this.currentData, null, 2));
    } catch (error) {
      console.error('Fehler beim Speichern der obs-data.json:', error);
    }
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('🛑 HTTP Server gestoppt');
      });
    }
  }

  getURL() {
    return `http://localhost:${this.port}`;
  }

  getOBSDisplayURL() {
    return `${this.getURL()}/obs-display.html`;
  }
}

// Export für Verwendung in anderen Modulen
module.exports = MoodMusicHTTPServer;

// Standalone Ausführung
if (require.main === module) {
  const server = new MoodMusicHTTPServer(8081);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Shutting down HTTP server...');
    server.stop();
    process.exit(0);
  });

  // Beispiel-Daten nach 3 Sekunden senden
  setTimeout(() => {
    server.updateOBSData({
      song: {
        id: 'demo-song-1',
        title: 'HTTP Server Demo',
        artist: 'Mood Music System',
        album: 'Server Integration',
        cover: null
      },
      mood: {
        name: 'Connected',
        color: '#22c55e',
        pulseSpeed: 1.8,
        intensity: 'moderate'
      },
      settings: {
        obsAlwaysShow: true,
        obsShowCover: true
      },
      showDisplay: true
    });
  }, 3000);
}