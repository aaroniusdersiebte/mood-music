// 🎵 HTTP Server Integration Service für Mood Music
// Automatischer Start/Stop des HTTP Servers mit der Hauptanwendung

class HTTPServerIntegrationService {
  constructor() {
    this.server = null;
    this.isInitialized = false;
    this.obsDisplayURL = null;
    this.lastSongData = null;
    this.ImprovedMoodMusicHTTPServer = null;
  }

  async initialize(settings = {}) {
    if (this.isInitialized) {
      console.log('ℹ️ HTTP Server Integration bereits initialisiert');
      return this.obsDisplayURL;
    }

    try {
      console.log('🌐 Starte HTTP Server Integration...');
      
      // Dynamischer Import des HTTP Servers (CommonJS kompatibel)
      if (!this.ImprovedMoodMusicHTTPServer) {
        // Für React/Browser Umgebung: HTTP Server über fetch API simulieren
        if (typeof window !== 'undefined') {
          console.log('Browser-Umgebung erkannt - verwende extern gestarteten HTTP Server');
          return await this.initializeBrowserMode(settings);
        }
        
        // Für Node.js Umgebung: Direkter Import
        try {
          this.ImprovedMoodMusicHTTPServer = require('./improvedMoodMusicHTTPServer');
        } catch (error) {
          console.log('Node.js HTTP Server nicht verfügbar, nutze Browser-Modus');
          return await this.initializeBrowserMode(settings);
        }
      }
      
      // Erstelle neuen Server-Instanz
      const startPort = settings.httpServerPort || 8080;
      this.server = new this.ImprovedMoodMusicHTTPServer(startPort);
      
      // Server starten
      this.obsDisplayURL = await this.server.start();
      this.isInitialized = true;
      
      console.log('✅ HTTP Server Integration erfolgreich gestartet!');
      console.log(`🎵 OBS URL: ${this.obsDisplayURL}`);
      console.log(`🧪 Test URL: ${this.server.getTestURL()}`);
      
      // In localStorage für andere Komponenten speichern
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('moodMusicHTTPServerURL', this.obsDisplayURL);
        localStorage.setItem('moodMusicHTTPServerTestURL', this.server.getTestURL());
      }
      
      return this.obsDisplayURL;
      
    } catch (error) {
      console.error('❌ Fehler beim Starten der HTTP Server Integration:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async initializeBrowserMode(settings) {
    // Browser-Modus: Versuche Verbindung zu extern gestartetem HTTP Server
    const port = settings.httpServerPort || 8080;
    const serverURL = `http://localhost:${port}`;
    
    try {
      // Test ob ein HTTP Server läuft
      const response = await fetch(`${serverURL}/status`);
      if (response.ok) {
        this.obsDisplayURL = `${serverURL}/obs-display.html`;
        this.isInitialized = true;
        
        console.log('✅ Extern gestarteter HTTP Server gefunden!');
        console.log(`🎵 OBS URL: ${this.obsDisplayURL}`);
        
        // In localStorage speichern
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('moodMusicHTTPServerURL', this.obsDisplayURL);
          localStorage.setItem('moodMusicHTTPServerTestURL', `${serverURL}/test`);
        }
        
        return this.obsDisplayURL;
      }
    } catch (error) {
      console.log('Kein externer HTTP Server gefunden:', error.message);
    }
    
    // Fallback: Nur localStorage-basierte Updates
    console.log('⚠️ Kein HTTP Server verfügbar - verwende nur LocalStorage Updates');
    this.isInitialized = true;
    return null;
  }

  async updateSongDisplay(song, mood, settings) {
    if (!this.isInitialized) {
      console.warn('⚠️ HTTP Server Integration nicht initialisiert');
      return false;
    }

    try {
      const obsData = {
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          cover: song.cover || null,
          moodBackground: mood.background || null
        },
        mood: {
          id: mood.id,
          name: mood.name,
          color: mood.color,
          pulseSpeed: mood.pulseSpeed || 2.0,
          intensity: mood.intensity || 'moderate',
          background: mood.background || null
        },
        settings: {
          obsPort: settings.obsPort || 4454,
          obsDisplayDuration: settings.obsDisplayDuration || 5000,
          obsAlwaysShow: settings.obsAlwaysShow !== false,
          obsShowCover: settings.obsShowCover !== false,
          obsWebSocketEnabled: settings.obsWebSocketEnabled || false
        },
        showDisplay: true,
        timestamp: Date.now()
      };

      // 1. LocalStorage Update (funktioniert immer)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('obs-display-data', JSON.stringify(obsData));
      }

      // 2. HTTP Server Update (wenn verfügbar)
      if (this.server && this.server.updateOBSData) {
        // Node.js Modus: Direkter Server Update
        this.server.updateOBSData(obsData);
        this.lastSongData = obsData;
      } else if (this.obsDisplayURL) {
        // Browser Modus: HTTP Request an externen Server
        try {
          const serverURL = this.obsDisplayURL.replace('/obs-display.html', '');
          const response = await fetch(`${serverURL}/update-obs-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(obsData)
          });
          
          if (response.ok) {
            this.lastSongData = obsData;
          } else {
            console.warn('HTTP Server Update fehlgeschlagen:', response.status);
          }
        } catch (error) {
          console.warn('HTTP Server nicht erreichbar:', error.message);
        }
      }
      
      console.log(`🎵 Song Display aktualisiert: "${song.title}" von ${song.artist}`);
      return true;
      
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Song Displays:', error);
      return false;
    }
  }

  getServerInfo() {
    if (!this.isInitialized) {
      return {
        running: false,
        error: 'Integration nicht gestartet'
      };
    }

    if (this.server && this.server.isServerRunning) {
      // Node.js Modus
      return {
        running: this.server.isServerRunning(),
        port: this.server.port,
        obsURL: this.server.getOBSDisplayURL(),
        testURL: this.server.getTestURL(),
        statusURL: this.server.getStatusURL(),
        lastSong: this.lastSongData?.song?.title || 'Kein Song',
        lastUpdate: this.lastSongData?.timestamp || null,
        mode: 'embedded'
      };
    } else if (this.obsDisplayURL) {
      // Browser Modus
      const serverURL = this.obsDisplayURL.replace('/obs-display.html', '');
      return {
        running: true,
        obsURL: this.obsDisplayURL,
        testURL: `${serverURL}/test`,
        statusURL: `${serverURL}/status`,
        lastSong: this.lastSongData?.song?.title || 'Kein Song',
        lastUpdate: this.lastSongData?.timestamp || null,
        mode: 'external'
      };
    }

    return {
      running: true,
      mode: 'localStorage-only',
      lastSong: this.lastSongData?.song?.title || 'Kein Song',
      lastUpdate: this.lastSongData?.timestamp || null
    };
  }

  async testConnection() {
    if (!this.isInitialized) {
      throw new Error('Integration nicht verfügbar');
    }

    try {
      // Test-Daten erstellen
      const testData = {
        song: {
          id: 'test-' + Date.now(),
          title: 'HTTP Server Test',
          artist: 'Mood Music System',
          album: 'Connection Test',
          cover: 'https://via.placeholder.com/300x300/4ade80/ffffff?text=TEST'
        },
        mood: {
          id: 'test-mood',
          name: 'Test Mode',
          color: '#4ade80',
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

      // Test-Update durchführen
      const success = await this.updateSongDisplay(testData.song, testData.mood, testData.settings);
      
      if (success) {
        console.log('✅ HTTP Server Connection Test erfolgreich');
        const info = this.getServerInfo();
        return {
          success: true,
          message: 'Test erfolgreich',
          mode: info.mode,
          testURL: info.testURL,
          obsURL: info.obsURL
        };
      } else {
        throw new Error('Update fehlgeschlagen');
      }
      
    } catch (error) {
      console.error('❌ HTTP Server Connection Test fehlgeschlagen:', error);
      throw error;
    }
  }

  async restart() {
    console.log('🔄 HTTP Server Integration wird neu gestartet...');
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s warten
      return await this.initialize();
    } catch (error) {
      console.error('❌ Fehler beim Neustart der HTTP Server Integration:', error);
      throw error;
    }
  }

  async stop() {
    if (this.server && this.server.stop) {
      try {
        await this.server.stop();
        console.log('🛑 Embedded HTTP Server gestoppt');
      } catch (error) {
        console.error('❌ Fehler beim Stoppen des embedded HTTP Servers:', error);
      }
    }
    
    this.isInitialized = false;
    this.obsDisplayURL = null;
    this.server = null;
    
    // localStorage bereinigen
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('moodMusicHTTPServerURL');
      localStorage.removeItem('moodMusicHTTPServerTestURL');
    }
    
    console.log('🛑 HTTP Server Integration gestoppt');
  }

  isRunning() {
    return this.isInitialized;
  }

  getOBSURL() {
    return this.obsDisplayURL;
  }

  // Für Debugging und externe Zugriffe
  getServerInstance() {
    return this.server;
  }
}

// Singleton-Instanz
const httpServerIntegrationService = new HTTPServerIntegrationService();

// Globale Verfügbarkeit für Debugging
if (typeof window !== 'undefined') {
  window.httpServerIntegrationService = httpServerIntegrationService;
}

// ES6 Export für React
export default httpServerIntegrationService;

// CommonJS Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = httpServerIntegrationService;
}
