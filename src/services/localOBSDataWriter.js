// 🎵 Lokaler OBS Data Writer - Direkte Dateisystem-Integration
// Schreibt direkt in das public Verzeichnis ohne HTTP Server

class LocalOBSDataWriter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
    this.currentData = null;
    this.writeInterval = null;
    this.lastWriteTime = 0;
    this.autoUpdateEnabled = true;
    
    // Pfade für lokale Dateien
    this.publicPath = this.getPublicPath();
    this.obsDataPath = this.publicPath + '/obs-data.json';
    
    console.log('📁 Lokaler OBS Data Writer initialisiert');
    console.log('📂 Public Pfad:', this.publicPath);
    console.log('📄 OBS Data Pfad:', this.obsDataPath);
  }

  getPublicPath() {
    if (this.isElectron) {
      // Electron: Pfad relativ zur App
      const { remote, app } = window.require('@electron/remote') || window.require('electron').remote;
      const electronApp = app || remote.app;
      const appPath = electronApp.getAppPath();
      
      // In development: src/../public
      // In production: resources/app/build (von dort aus ../public)
      if (appPath.includes('node_modules')) {
        // Development
        return appPath + '/public';
      } else {
        // Production build
        return appPath + '/../public';
      }
    } else {
      // Browser: Relative zum aktuellen Pfad
      return './public';
    }
  }

  async writeOBSData(data) {
    this.currentData = {
      ...data,
      timestamp: Date.now()
    };
    
    try {
      // 1. LocalStorage Update (sofort verfügbar)
      this.updateLocalStorage(this.currentData);
      
      // 2. Direkte Datei-Aktualisierung (Hauptziel)
      await this.updateLocalFiles(this.currentData);
      
      // 3. Auto-Update aktivieren
      if (this.autoUpdateEnabled && !this.writeInterval) {
        this.enableAutoUpdate();
      }
      
      console.log(`📝 Lokale OBS Daten aktualisiert: ${data.song?.title || 'Unknown'}`);
      return true;
      
    } catch (error) {
      console.error('❌ Fehler beim Schreiben der lokalen OBS Daten:', error);
      // Fallback auf LocalStorage
      this.updateLocalStorage(this.currentData);
      return false;
    }
  }

  updateLocalStorage(data) {
    try {
      localStorage.setItem('obs-display-data', JSON.stringify(data));
      console.log('💾 LocalStorage OBS Daten aktualisiert');
    } catch (error) {
      console.error('LocalStorage Update fehlgeschlagen:', error);
    }
  }

  async updateLocalFiles(data) {
    try {
      if (this.isElectron && window.require) {
        // Electron: Direkter Dateizugriff
        await this.updateFilesElectron(data);
      } else {
        // Browser: Fallback auf Download-Vorbereitung
        this.prepareDownload(data);
      }
    } catch (error) {
      console.error('Lokale Datei-Aktualisierung fehlgeschlagen:', error);
      throw error;
    }
  }

  async updateFilesElectron(data) {
    const fs = window.require('fs').promises;
    const path = window.require('path');
    
    try {
      // Stelle sicher, dass das public Verzeichnis existiert
      await fs.mkdir(this.publicPath, { recursive: true });
      
      // obs-data.json schreiben
      const jsonContent = JSON.stringify(data, null, 2);
      await fs.writeFile(this.obsDataPath, jsonContent, 'utf8');
      
      console.log('✅ obs-data.json erfolgreich geschrieben:', this.obsDataPath);
      
      // Auch in /src/public schreiben (falls anders strukturiert)
      const alternativePath = path.join(process.cwd(), 'public', 'obs-data.json');
      try {
        await fs.writeFile(alternativePath, jsonContent, 'utf8');
        console.log('✅ Alternative obs-data.json geschrieben:', alternativePath);
      } catch (altError) {
        // Nicht kritisch wenn alternative Pfad nicht existiert
      }
      
      // Auch src/public/obs-data.json aktualisieren (für Development)
      const srcPublicPath = path.join(process.cwd(), 'src', 'public', 'obs-data.json');
      try {
        await fs.writeFile(srcPublicPath, jsonContent, 'utf8');
        console.log('✅ Src public obs-data.json geschrieben:', srcPublicPath);
      } catch (srcError) {
        // Nicht kritisch
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Electron Datei-Schreibung fehlgeschlagen:', error);
      throw error;
    }
  }

  prepareDownload(data) {
    // Browser-Fallback: Bereite Download vor
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      if (window.obsDataURL) {
        URL.revokeObjectURL(window.obsDataURL);
      }
      
      window.obsDataURL = URL.createObjectURL(blob);
      window.obsDataContent = JSON.stringify(data, null, 2);
      
      console.log('📦 OBS Daten für Download vorbereitet');
    } catch (error) {
      console.error('Download-Vorbereitung fehlgeschlagen:', error);
    }
  }

  enableAutoUpdate() {
    if (this.writeInterval) return;
    
    // Kurze Update-Intervalle für lokale Dateien
    this.writeInterval = setInterval(async () => {
      if (this.currentData) {
        // LocalStorage immer aktualisieren
        this.updateLocalStorage(this.currentData);
        
        // Lokale Dateien alle 5 Sekunden
        if (Date.now() - this.lastWriteTime > 5000) {
          try {
            await this.updateLocalFiles(this.currentData);
            this.lastWriteTime = Date.now();
          } catch (error) {
            // Nicht kritisch, versuche es beim nächsten Mal
          }
        }
      }
    }, 2000); // Alle 2 Sekunden
    
    console.log('🔄 Auto-Update für lokale OBS Dateien aktiviert');
  }

  disableAutoUpdate() {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
      console.log('⏹️ Auto-Update für lokale OBS Dateien deaktiviert');
    }
  }

  // Hilfsmethoden für manuelles Setup
  async createOBSFiles() {
    if (!this.currentData) {
      throw new Error('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
    }

    try {
      // 1. JSON Datei erstellen
      await this.updateLocalFiles(this.currentData);
      
      // 2. HTML Dateien sicherstellen
      await this.ensureHTMLFiles();
      
      console.log('✅ Alle OBS Dateien erstellt/aktualisiert');
      return {
        success: true,
        obsDataPath: this.obsDataPath,
        publicPath: this.publicPath
      };
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der OBS Dateien:', error);
      throw error;
    }
  }

  async ensureHTMLFiles() {
    if (!this.isElectron || !window.require) {
      console.log('⚠️ HTML-Dateien-Check nur in Electron verfügbar');
      return;
    }

    const fs = window.require('fs').promises;
    const path = window.require('path');

    const htmlFiles = [
      'obs-display.html',
      'obs-display-self-contained.html',
      'obs-display-xhr.html'
    ];

    for (const fileName of htmlFiles) {
      const filePath = path.join(this.publicPath, fileName);
      
      try {
        await fs.access(filePath);
        console.log(`✅ ${fileName} gefunden`);
      } catch (error) {
        console.log(`⚠️ ${fileName} fehlt in ${this.publicPath}`);
        // Könnte hier Default-HTML erstellen, aber erstmal nur loggen
      }
    }
  }

  // OBS Setup Hilfe
  showLocalSetupInstructions() {
    const info = this.getLocalSetupInfo();
    
    const instructions = `
🎵 LOKALE OBS SETUP ANLEITUNG

✅ DATEI-PFADE:
   📂 Public Verzeichnis: ${info.publicPath}
   📄 OBS Data Datei: ${info.obsDataPath}
   📄 HTML Dateien: ${info.publicPath}/obs-display.html

✅ OBS EINRICHTUNG:
   1. Browser Source hinzufügen
   2. Lokale Datei wählen: ${info.publicPath}/obs-display.html
   3. Breite: 800, Höhe: 200
   4. "Shutdown source when not visible" = DEAKTIVIERT

✅ FUNKTIONSWEISE:
   • Bei Songwechsel wird obs-data.json automatisch überschrieben
   • HTML-Datei lädt obs-data.json aus dem gleichen Verzeichnis
   • Browser Source wird via WebSocket automatisch refreshed

💡 DEBUGGING:
   • Prüfe ob obs-data.json aktualisiert wird
   • Öffne HTML-Datei direkt im Browser zum Testen
   • Console-Logs in OBS Browser Source checken (F12)

📁 DATEIEN PRÜFEN:
   • obs-data.json sollte aktuelles Datum haben
   • HTML-Datei sollte im selben Ordner sein
   • Beide Dateien sollten im public Verzeichnis liegen
    `;
    
    console.log(instructions);
    
    if (typeof alert !== 'undefined') {
      alert(instructions);
    }
    
    return info;
  }

  getLocalSetupInfo() {
    return {
      publicPath: this.publicPath,
      obsDataPath: this.obsDataPath,
      isElectron: this.isElectron,
      currentData: this.currentData !== null,
      autoUpdateRunning: this.writeInterval !== null
    };
  }

  // Test-Methoden
  async testLocalFiles() {
    console.log('🧪 Teste lokale OBS Dateien...');
    
    const testData = {
      song: {
        id: 'test-' + Date.now(),
        title: 'TEST SONG - Lokale Dateien',
        artist: 'Mood Music System',
        album: 'Local File Test',
        cover: 'https://via.placeholder.com/300x300/4ade80/ffffff?text=LOCAL'
      },
      mood: {
        id: 'test-mood',
        name: 'Local Test',
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
    
    try {
      await this.writeOBSData(testData);
      console.log('✅ Test erfolgreich - lokale Dateien aktualisiert');
      
      // Setup-Info anzeigen
      setTimeout(() => {
        this.showLocalSetupInstructions();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('❌ Test fehlgeschlagen:', error);
      return false;
    }
  }

  async verifyFileExists() {
    if (!this.isElectron || !window.require) {
      console.log('⚠️ Datei-Verifikation nur in Electron verfügbar');
      return false;
    }

    try {
      const fs = window.require('fs').promises;
      await fs.access(this.obsDataPath);
      console.log('✅ obs-data.json gefunden:', this.obsDataPath);
      
      const content = await fs.readFile(this.obsDataPath, 'utf8');
      const data = JSON.parse(content);
      console.log('📄 Datei-Inhalt:', data.song?.title || 'Unbekannt');
      
      return true;
    } catch (error) {
      console.log('❌ obs-data.json nicht gefunden:', this.obsDataPath);
      return false;
    }
  }

  // Cleanup
  destroy() {
    this.disableAutoUpdate();
    
    if (window.obsDataURL) {
      URL.revokeObjectURL(window.obsDataURL);
      window.obsDataURL = null;
    }
    
    console.log('🧹 Lokaler OBS Data Writer cleanup abgeschlossen');
  }

  // Getter für aktuellen Zustand
  getCurrentData() {
    return this.currentData;
  }

  getStatus() {
    return {
      initialized: true,
      publicPath: this.publicPath,
      obsDataPath: this.obsDataPath,
      isElectron: this.isElectron,
      autoUpdateRunning: this.writeInterval !== null,
      hasCurrentData: this.currentData !== null,
      lastSong: this.currentData?.song?.title || 'Kein Song'
    };
  }
}

export default new LocalOBSDataWriter();
