// 🎵 Lokaler OBS Data Writer - Direkte Dateisystem-Integration
// Schreibt direkt obs-data.json Dateien in public Verzeichnisse ohne HTTP Server

class LocalOBSDataWriter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
    this.currentData = null;
    this.writeInterval = null;
    this.lastWriteTime = 0;
    this.autoUpdateEnabled = true;
    
    // Pfade für lokale obs-data.json Dateien
    this.targetPaths = this.getTargetPaths();
    
    console.log('📁 Lokaler OBS Data Writer initialisiert');
    console.log('📂 Ziel-Pfade:', this.targetPaths);
  }

  getTargetPaths() {
    const paths = [];
    
    if (this.isElectron) {
      try {
        // Node.js APIs für Electron
        const path = window.require('path');
        const process = window.require('process');
        
        // 1. Public Verzeichnis im Hauptprojekt  
        paths.push(path.join(process.cwd(), 'public', 'obs-data.json'));
        
        // 2. Src/public für Development
        paths.push(path.join(process.cwd(), 'src', 'public', 'obs-data.json'));
        
        // 3. Build/public für Production
        paths.push(path.join(process.cwd(), 'build', 'obs-data.json'));
        
        // 4. Relative Pfade falls anders strukturiert
        paths.push('./public/obs-data.json');
        paths.push('./build/obs-data.json');
        
      } catch (error) {
        console.warn('⚠️ Node.js Pfad-APIs nicht verfügbar:', error.message);
      }
    }
    
    // Browser Fallback Pfade
    paths.push('./public/obs-data.json');
    paths.push('./obs-data.json');
    
    return [...new Set(paths)]; // Duplikate entfernen
  }

  async writeOBSData(data) {
    this.currentData = {
      ...data,
      timestamp: Date.now(),
      localFileWriter: true
    };
    
    try {
      // 1. LocalStorage Update (sofort verfügbar)
      this.updateLocalStorage(this.currentData);
      
      // 2. Direkte Datei-Aktualisierung in alle Ziel-Pfade
      const writeResults = await this.writeToAllTargets(this.currentData);
      
      // 3. Auto-Update aktivieren
      if (this.autoUpdateEnabled && !this.writeInterval) {
        this.enableAutoUpdate();
      }
      
      const successCount = writeResults.filter(r => r.success).length;
      
      if (successCount > 0) {
        console.log(`✅ obs-data.json erfolgreich geschrieben (${successCount}/${writeResults.length} Pfade): ${data.song?.title || 'Unknown'}`);
      } else {
        console.log(`📦 Fallback auf LocalStorage: ${data.song?.title || 'Unknown'}`);
      }
      
      return successCount > 0;
      
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

  async writeToAllTargets(data) {
    if (!this.isElectron || !window.require) {
      console.log('⚠️ Electron nicht verfügbar - verwende nur LocalStorage');
      this.prepareDownload(data);
      return [{ path: 'localStorage', success: true }];
    }

    const results = [];
    const fs = window.require('fs').promises;
    const path = window.require('path');
    const jsonContent = JSON.stringify(data, null, 2);

    for (const targetPath of this.targetPaths) {
      try {
        // Stelle sicher, dass das Verzeichnis existiert
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });
        
        // Schreibe JSON-Datei
        await fs.writeFile(targetPath, jsonContent, 'utf8');
        
        // 🎯 NEUE FUNKTION: Kopiere auch die HTML-Datei ins gleiche Verzeichnis
        await this.ensureHTMLFile(dir);
        
        results.push({ 
          path: targetPath, 
          success: true 
        });
        
        console.log(`✅ obs-data.json geschrieben: ${targetPath}`);
        
      } catch (error) {
        results.push({ 
          path: targetPath, 
          success: false, 
          error: error.message 
        });
        
        // Nur loggen wenn es ein unerwarteter Fehler ist
        if (!error.message.includes('ENOENT') && !error.message.includes('no such file')) {
          console.warn(`⚠️ Konnte nicht schreiben in ${targetPath}:`, error.message);
        }
      }
    }

    return results;
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

  // 🎯 NEUE FUNKTION: Stelle sicher, dass die HTML-Datei im Zielverzeichnis existiert
  async ensureHTMLFile(targetDir) {
    if (!this.isElectron || !window.require) {
      return;
    }

    try {
      const fs = window.require('fs').promises;
      const path = window.require('path');
      
      const htmlTargetPath = path.join(targetDir, 'obs-display-xhr.html');
      
      // Prüfe ob HTML-Datei bereits existiert
      try {
        await fs.access(htmlTargetPath);
        // console.log(`✅ obs-display-xhr.html bereits vorhanden: ${htmlTargetPath}`);
        return; // Datei existiert bereits
      } catch (error) {
        // Datei existiert nicht, erstelle sie
      }
      
      // Lade HTML-Content von der ursprünglichen Datei
      const originalHTMLPath = path.join(process.cwd(), 'public', 'obs-display-xhr.html');
      
      let htmlContent;
      try {
        htmlContent = await fs.readFile(originalHTMLPath, 'utf8');
      } catch (error) {
        // Fallback: Erstelle HTML-Content direkt
        htmlContent = this.createDefaultHTMLContent();
      }
      
      // Schreibe HTML-Datei ins Zielverzeichnis
      await fs.writeFile(htmlTargetPath, htmlContent, 'utf8');
      
      console.log(`✅ obs-display-xhr.html kopiert nach: ${htmlTargetPath}`);
      
    } catch (error) {
      console.warn('⚠️ Konnte HTML-Datei nicht kopieren:', error.message);
    }
  }

  enableAutoUpdate() {
    if (this.writeInterval) return;
    
    // Moderater Update-Intervall für lokale Dateien
    this.writeInterval = setInterval(async () => {
      if (this.currentData && Date.now() - this.lastWriteTime > 3000) {
        try {
          // LocalStorage immer aktualisieren
          this.updateLocalStorage(this.currentData);
          
          // Lokale Dateien aktualisieren
          await this.writeToAllTargets(this.currentData);
          this.lastWriteTime = Date.now();
          
        } catch (error) {
          // Nicht kritisch, versuche es beim nächsten Mal
        }
      }
    }, 3000); // Alle 3 Sekunden
    
    console.log('🔄 Auto-Update für lokale OBS Dateien aktiviert');
  }

  disableAutoUpdate() {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
      console.log('⏹️ Auto-Update für lokale OBS Dateien deaktiviert');
    }
  }

  // Fallback HTML-Content falls die Original-Datei nicht gefunden wird
  createDefaultHTMLContent() {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mood Music - OBS Display (Auto-Created)</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: transparent; overflow: hidden; width: 800px; height: 200px;
        }
        .song-display {
            position: relative; width: 100%; height: 100%; border-radius: 16px;
            overflow: hidden; opacity: 0; transform: translateY(40px);
            transition: all 0.6s ease; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        .song-display.visible { opacity: 1; transform: translateY(0); }
        .background {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-size: cover; background-position: center;
            filter: blur(25px) brightness(0.4); transform: scale(1.2);
        }
        .mood-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(135deg, #4ade8040, #3b82f640);
            mix-blend-mode: overlay; opacity: 0.7;
        }
        .content {
            position: relative; z-index: 10; display: flex; align-items: center;
            height: 100%; padding: 24px; background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .cover {
            width: 140px; height: 140px; border-radius: 12px; background: linear-gradient(135deg, #333, #555);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cover img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
        .cover-placeholder { color: #888; font-size: 32px; }
        .info { margin-left: 32px; color: white; flex: 1; }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .artist { font-size: 18px; opacity: 0.9; margin-bottom: 12px; }
        .album { font-size: 14px; opacity: 0.7; font-style: italic; }
        .mood-indicator {
            position: absolute; top: 20px; right: 20px; padding: 8px 16px;
            border-radius: 20px; font-size: 14px; font-weight: 600; color: white;
            background: rgba(255, 255, 255, 0.15); text-transform: uppercase;
        }
        .debug-status {
            position: absolute; bottom: 4px; left: 4px; font-size: 10px;
            color: rgba(255, 255, 255, 0.6); background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px; border-radius: 4px;
        }
    </style>
</head>
<body>
    <div id="songDisplay" class="song-display">
        <div id="background" class="background"></div>
        <div id="moodOverlay" class="mood-overlay"></div>
        <div class="content">
            <div class="cover">
                <img id="coverImage" src="" alt="Cover" style="display: none;">
                <div id="coverPlaceholder" class="cover-placeholder">♪</div>
            </div>
            <div class="info">
                <div id="songTitle" class="title">Mood Music</div>
                <div id="artistName" class="artist">Bereit für Songs...</div>
                <div id="albumName" class="album" style="display: none;"></div>
            </div>
        </div>
        <div id="moodIndicator" class="mood-indicator" style="display: none;"></div>
        <div id="debugStatus" class="debug-status">Auto-Created HTML</div>
    </div>
    <script>
        let currentSong = null, currentMood = null, lastDataTimestamp = 0, isVisible = false;
        function loadDisplayData() {
            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 0)) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data && data.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = data.timestamp;
                            updateDisplay(data);
                            document.getElementById('debugStatus').textContent = 'Verbunden ✓';
                        }
                    } catch (e) { tryLocalStorage(); }
                } else { tryLocalStorage(); }
            };
            xhr.onerror = tryLocalStorage;
            try { xhr.open('GET', './obs-data.json?t=' + Date.now(), true); xhr.send(); }
            catch (e) { tryLocalStorage(); }
        }
        function tryLocalStorage() {
            try {
                const data = localStorage.getItem('obs-display-data');
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.timestamp > lastDataTimestamp) {
                        lastDataTimestamp = parsed.timestamp;
                        updateDisplay(parsed);
                        document.getElementById('debugStatus').textContent = 'LocalStorage ⚠';
                    }
                }
            } catch (e) {
                document.getElementById('debugStatus').textContent = 'Keine Daten';
                document.getElementById('artistName').textContent = 'obs-data.json nicht gefunden';
            }
        }
        function updateDisplay(data) {
            const { song, mood, showDisplay } = data;
            if (song && mood && showDisplay) {
                document.getElementById('songTitle').textContent = song.title || 'Unbekannt';
                document.getElementById('artistName').textContent = song.artist || 'Unbekannt';
                if (song.album) {
                    document.getElementById('albumName').textContent = song.album;
                    document.getElementById('albumName').style.display = 'block';
                }
                if (song.cover && song.cover !== 'null') {
                    document.getElementById('coverImage').src = song.cover;
                    document.getElementById('coverImage').style.display = 'block';
                    document.getElementById('coverPlaceholder').style.display = 'none';
                    document.getElementById('background').style.backgroundImage = \`url(\${song.cover})\`;
                }
                if (mood.color) {
                    document.getElementById('moodOverlay').style.background = \`linear-gradient(135deg, \${mood.color}40, \${mood.color}20)\`;
                    document.getElementById('moodIndicator').style.background = \`\${mood.color}60\`;
                }
                document.getElementById('moodIndicator').textContent = mood.name;
                document.getElementById('moodIndicator').style.display = 'block';
                document.getElementById('songDisplay').classList.add('visible');
                isVisible = true;
            }
        }
        loadDisplayData();
        setInterval(loadDisplayData, 2000);
        console.log('🎵 Auto-Created Mood Music OBS Display bereit!');
    </script>
</body>
</html>`;
  }
  async testLocalFiles() {
    console.log('🧪 Teste lokale OBS Dateien...');
    
    const testData = {
      song: {
        id: 'test-' + Date.now(),
        title: 'TEST - Lokale Dateien',
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
      const success = await this.writeOBSData(testData);
      
      if (success) {
        console.log('✅ Test erfolgreich - lokale Dateien aktualisiert');
        this.showLocalSetupInstructions();
      } else {
        console.log('⚠️ Test teilweise erfolgreich - LocalStorage Update');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Test fehlgeschlagen:', error);
      return false;
    }
  }

  async verifyFiles() {
    if (!this.isElectron || !window.require) {
      console.log('⚠️ Datei-Verifikation nur in Electron verfügbar');
      return { verified: false, reason: 'not-electron' };
    }

    const fs = window.require('fs').promises;
    const results = [];

    for (const targetPath of this.targetPaths) {
      try {
        await fs.access(targetPath);
        const content = await fs.readFile(targetPath, 'utf8');
        const data = JSON.parse(content);
        
        results.push({
          path: targetPath,
          exists: true,
          lastSong: data.song?.title || 'Unknown',
          timestamp: data.timestamp
        });
        
        console.log(`✅ ${targetPath} gefunden - Song: ${data.song?.title}`);
        
      } catch (error) {
        results.push({
          path: targetPath,
          exists: false,
          error: error.message
        });
      }
    }

    const existingFiles = results.filter(r => r.exists);
    console.log(`📊 Verifikation: ${existingFiles.length}/${results.length} Dateien gefunden`);

    return {
      verified: existingFiles.length > 0,
      results: results,
      summary: `${existingFiles.length}/${results.length} Dateien existieren`
    };
  }

  showLocalSetupInstructions() {
    const instructions = `
🎵 LOKALE OBS SETUP ANLEITUNG - DIREKTE DATEIEN

✅ WAS PASSIERT:
   • obs-data.json wird direkt in public/ Verzeichnisse geschrieben
   • Bei Songwechsel wird die Datei automatisch überschrieben
   • Keine HTTP Server nötig - nur lokale Dateien!

✅ OBS EINRICHTUNG:
   1. Browser Source hinzufügen
   2. Lokale Datei wählen: [Projektpfad]/public/obs-display.html
   3. Breite: 800, Höhe: 200
   4. "Shutdown source when not visible" = DEAKTIVIERT

✅ DATEIPFADE:
   ${this.targetPaths.join('\n   ')}

✅ FUNKTIONSWEISE:
   • Bei Songwechsel → obs-data.json wird überschrieben
   • HTML lädt obs-data.json aus dem gleichen Verzeichnis
   • Browser Source wird via OBS WebSocket refreshed

💡 DEBUGGING:
   • Prüfe ob obs-data.json existiert und aktuell ist
   • Öffne obs-display.html direkt im Browser
   • Console-Logs checken: localStorage und JSON-Datei
    `;
    
    console.log(instructions);
    
    if (typeof alert !== 'undefined') {
      alert(instructions);
    }
  }

  getStatus() {
    return {
      initialized: true,
      isElectron: this.isElectron,
      targetPaths: this.targetPaths,
      autoUpdateRunning: this.writeInterval !== null,
      hasCurrentData: this.currentData !== null,
      lastSong: this.currentData?.song?.title || 'Kein Song',
      lastWrite: this.lastWriteTime
    };
  }

  // Legacy Methods für Kompatibilität mit obsDataWriter Interface
  downloadOBSData() {
    if (window.obsDataURL) {
      const a = document.createElement('a');
      a.href = window.obsDataURL;
      a.download = 'obs-data.json';
      a.click();
      console.log('📥 obs-data.json heruntergeladen');
    } else {
      console.warn('Keine OBS Daten verfügbar');
      alert('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
    }
  }

  downloadOBSPackage(htmlContent) {
    if (!window.obsDataContent) {
      alert('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
      return;
    }
    
    try {
      // HTML-Datei downloaden
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      
      const htmlLink = document.createElement('a');
      htmlLink.href = htmlUrl;
      htmlLink.download = 'obs-display.html';
      htmlLink.click();
      
      // JSON-Datei mit Verzögerung downloaden
      setTimeout(() => {
        const jsonBlob = new Blob([window.obsDataContent], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = 'obs-data.json';
        jsonLink.click();
        
        // Cleanup
        setTimeout(() => {
          URL.revokeObjectURL(htmlUrl);
          URL.revokeObjectURL(jsonUrl);
        }, 1000);
        
      }, 800);
      
      console.log('📦 Komplettes OBS Package heruntergeladen');
      
    } catch (error) {
      console.error('Fehler beim Erstellen des OBS Packages:', error);
      alert('Fehler beim Erstellen des Download-Packages. Bitte erneut versuchen.');
    }
  }

  // Für Testing
  getCurrentData() {
    return this.currentData;
  }

  async readOBSData() {
    try {
      // Try localStorage first
      const data = localStorage.getItem('obs-display-data');
      if (data) {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to read OBS data:', error);
      return null;
    }
  }

  // HTTP Server Compatibility (deaktiviert)
  getHTTPServerStatus() {
    return {
      available: false,
      port: null,
      url: null,
      obsURL: null,
      mode: 'local-files-only'
    };
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
}

export default new LocalOBSDataWriter();
