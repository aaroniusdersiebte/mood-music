// Verbesserte OBS Data Writer Service - nutzt primär HTTP Server
class OBSDataWriter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
    this.fallbackStorage = false;
    this.currentData = null;
    this.writeInterval = null;
    this.lastWriteTime = 0;
    this.autoUpdateEnabled = true;
    this.httpServerAvailable = false;
    this.httpServerPort = 8081;
    
    // Prüfe HTTP Server Verfügbarkeit
    this.checkHTTPServerAvailability();
  }

  async checkHTTPServerAvailability() {
    try {
      // Prüfe verschiedene Ports
      const ports = [8080, 8081, 8082];
      
      for (const port of ports) {
        try {
          const response = await fetch(`http://localhost:${port}/status`, { 
            method: 'GET',
            signal: AbortSignal.timeout(1000) // 1 Sekunde Timeout
          });
          
          if (response.ok) {
            this.httpServerAvailable = true;
            this.httpServerPort = port;
            console.log(`🌐 HTTP Server gefunden auf Port ${port}`);
            return;
          }
        } catch (error) {
          // Port nicht verfügbar, versuche nächsten
        }
      }
      
      this.httpServerAvailable = false;
      console.log('📦 HTTP Server nicht verfügbar, verwende LocalStorage');
    } catch (error) {
      this.httpServerAvailable = false;
    }
  }

  async writeOBSData(data) {
    this.currentData = data;
    
    try {
      // 1. HTTP Server Update (PRIMÄR - wenn verfügbar)
      const httpSuccess = await this.updateHTTPServer(data);
      
      // 2. LocalStorage (IMMER - als Fallback)
      localStorage.setItem('obs-display-data', JSON.stringify(data));
      
      // 3. Electron File System (wenn verfügbar)
      if (this.isElectron && window.electronAPI && window.electronAPI.writeOBSData) {
        await window.electronAPI.writeOBSData(data);
        console.log('📁 Electron: OBS data geschrieben');
      }
      
      // 4. Download-Vorbereitung (ohne Auto-Download)
      this.createDownloadableJSON(data);
      
      // 5. Auto-Update aktivieren (reduzierte Frequenz)
      if (this.autoUpdateEnabled && !this.writeInterval) {
        this.enableAutoUpdate();
      }
      
      // Status-Update
      if (httpSuccess) {
        console.log(`🌐 OBS Update via HTTP Server: ${data.song?.title || 'Unknown'}`);
      } else {
        console.log(`📦 OBS Update via LocalStorage: ${data.song?.title || 'Unknown'}`);
      }
      
    } catch (error) {
      console.error('Fehler beim Schreiben der OBS Daten:', error);
      // Nicht werfen - LocalStorage sollte immer funktionieren
    }
  }

  async updateHTTPServer(data) {
    // Prüfe zuerst ob Server verfügbar ist
    if (!this.httpServerAvailable) {
      await this.checkHTTPServerAvailability();
    }
    
    if (!this.httpServerAvailable) {
      return false;
    }
    
    try {
      const response = await fetch(`http://localhost:${this.httpServerPort}/update-obs-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(2000) // 2 Sekunden Timeout
      });
      
      if (response.ok) {
        return true;
      } else {
        console.warn(`HTTP Server Antwort: ${response.status}`);
        return false;
      }
    } catch (error) {
      // HTTP Server nicht erreichbar - markiere als nicht verfügbar
      this.httpServerAvailable = false;
      return false;
    }
  }

  createDownloadableJSON(data) {
    try {
      // JSON-Blob erstellen
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      // URL für Download erstellen
      if (window.obsDataURL) {
        URL.revokeObjectURL(window.obsDataURL);
      }
      
      window.obsDataURL = URL.createObjectURL(blob);
      window.obsDataContent = JSON.stringify(data, null, 2);
      
      // Kein automatisches Download mehr - nur bei manueller Anfrage
      if (!this.fallbackStorage) {
        console.log('📦 OBS data bereit für Download (Settings -> Download OBS Package)');
        this.fallbackStorage = true;
      }
      
    } catch (error) {
      console.error('Failed to create downloadable JSON:', error);
    }
  }

  enableAutoUpdate() {
    if (this.writeInterval) return;
    
    // Reduzierte Update-Frequenz - alle 5 Sekunden
    this.writeInterval = setInterval(() => {
      if (this.currentData) {
        // Nur LocalStorage aktualisieren, HTTP Server wird bei Bedarf gecheckt
        localStorage.setItem('obs-display-data', JSON.stringify(this.currentData));
        
        // HTTP Server Verfügbarkeit prüfen (alle 30 Sekunden)
        if (!this.httpServerAvailable && Math.random() < 0.1) {
          this.checkHTTPServerAvailability();
        }
      }
    }, 5000);
    
    console.log('🔄 Auto-update aktiviert (HTTP Server + LocalStorage)');
  }

  disableAutoUpdate() {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
      console.log('⏹️ Auto-update für OBS data deaktiviert');
    }
  }

  // Hilfsmethoden für HTTP Server Integration
  getHTTPServerStatus() {
    return {
      available: this.httpServerAvailable,
      port: this.httpServerPort,
      url: this.httpServerAvailable ? `http://localhost:${this.httpServerPort}` : null,
      obsURL: this.httpServerAvailable ? `http://localhost:${this.httpServerPort}/obs-display.html` : null
    };
  }
  
  async forceHTTPServerCheck() {
    await this.checkHTTPServerAvailability();
    return this.httpServerAvailable;
  }

  downloadOBSData() {
    if (window.obsDataURL) {
      const a = document.createElement('a');
      a.href = window.obsDataURL;
      a.download = 'obs-data.json';
      a.click();
      console.log('📥 obs-data.json heruntergeladen');
      
      setTimeout(() => {
        this.showSetupInstructions();
      }, 100);
    } else {
      console.warn('Keine OBS Daten verfügbar');
      alert('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
    }
  }

  showSetupInstructions() {
    const instructions = `
🎵 OBS Setup Anleitung:

✅ SCHRITT 1: Dateien vorbereiten
   • obs-data.json wurde heruntergeladen
   • Lade auch die HTML-Datei herunter
   • Beide Dateien in den SELBEN Ordner legen

✅ SCHRITT 2: OBS einrichten
   • Browser Source hinzufügen
   • Lokale Datei: HTML-Datei auswählen
   • Breite: 800, Höhe: 200
   • "Shutdown source when not visible" DEAKTIVIEREN

✅ SCHRITT 3: Testen
   • Song in Mood Music abspielen
   • obs-data.json wird automatisch aktualisiert
   • Browser Source in OBS refreshen falls nötig

💡 TIPP: Die obs-data.json aktualisiert sich automatisch bei Songwechsel!
    `;
    
    alert(instructions);
  }

  downloadOBSPackage(htmlContent) {
    if (!window.obsDataContent) {
      alert('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
      return;
    }
    
    try {
      // Verbesserte HTML mit besserer Fehlerbehandlung erstellen
      const improvedHTML = this.createImprovedHTML(htmlContent);
      
      // HTML-Datei downloaden
      const htmlBlob = new Blob([improvedHTML], { type: 'text/html' });
      const htmlUrl = URL.createObjectURL(htmlBlob);
      
      const htmlLink = document.createElement('a');
      htmlLink.href = htmlUrl;
      htmlLink.download = 'mood-music-obs-display.html';
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
          this.showSetupInstructions();
        }, 1000);
        
      }, 800);
      
      console.log('📦 Komplettes OBS Package heruntergeladen');
      
    } catch (error) {
      console.error('Fehler beim Erstellen des OBS Packages:', error);
      alert('Fehler beim Erstellen des Download-Packages. Bitte erneut versuchen.');
    }
  }

  createImprovedHTML(originalHTML) {
    // Verbessere die HTML-Datei mit besserer Fehlerbehandlung und Debug-Info
    let improvedHTML = originalHTML;
    
    // Bessere Verbindungslogik
    const improvedScript = `
        let currentSong = null;
        let currentMood = null;
        let lastDataTimestamp = 0;
        let isVisible = false;
        let connectionAttempts = 0;
        let loadAttempts = 0;
        const maxLoadAttempts = 30;

        // Debug-Informationen
        function updateDebugInfo(message) {
            console.log('🎵 OBS Display:', message);
            
            // Zeige Debug-Info in der UI
            const statusEl = document.getElementById('debugStatus');
            if (statusEl) {
                statusEl.textContent = message;
            }
        }

        // Verbesserte Daten-Lade-Funktion
        async function loadDisplayData() {
            loadAttempts++;
            
            try {
                // Versuche 1: obs-data.json aus dem gleichen Verzeichnis
                try {
                    const response = await fetch('./obs-data.json?t=' + Date.now());
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = data.timestamp;
                            updateDisplay(data);
                            updateDebugInfo('Verbunden ✅');
                            connectionAttempts = 0;
                            return true;
                        }
                    }
                } catch (fetchError) {
                    // Datei nicht gefunden
                }

                // Versuche 2: localStorage (falls Browser-Kontext der gleiche ist)
                try {
                    const data = localStorage.getItem('obs-display-data');
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = parsed.timestamp;
                            updateDisplay(parsed);
                            updateDebugInfo('LocalStorage ⚠️');
                            return true;
                        }
                    }
                } catch (storageError) {
                    // localStorage nicht verfügbar
                }

                // Keine Daten gefunden
                connectionAttempts++;
                
                if (loadAttempts <= 5) {
                    updateDebugInfo('Suche obs-data.json...');
                    document.getElementById('artistName').textContent = 'Suche Daten...';
                } else if (loadAttempts <= 15) {
                    updateDebugInfo('obs-data.json nicht gefunden');
                    document.getElementById('artistName').textContent = 'obs-data.json fehlt!';
                } else if (loadAttempts <= maxLoadAttempts) {
                    updateDebugInfo('Beide Dateien im selben Ordner?');
                    document.getElementById('artistName').textContent = 'Dateien im selben Ordner?';
                } else {
                    updateDebugInfo('Setup-Hilfe erforderlich');
                    document.getElementById('artistName').textContent = 'Setup-Hilfe: Siehe Console';
                    
                    // Detaillierte Hilfe in der Console
                    console.log('%c🎵 OBS Setup Hilfe:', 'color: #4ade80; font-weight: bold;');
                    console.log('1. obs-data.json und HTML-Datei in den SELBEN Ordner');
                    console.log('2. HTML-Datei als Browser Source in OBS hinzufügen');
                    console.log('3. Größe: 800x200');
                    console.log('4. Song in Mood Music abspielen');
                    console.log('5. obs-data.json wird automatisch aktualisiert');
                }

            } catch (error) {
                updateDebugInfo('Verbindungsfehler');
                console.error('Fehler beim Laden der OBS Daten:', error);
            }
            
            return false;
        }
    `;

    // Script-Bereich ersetzen
    if (improvedHTML.includes('<script>')) {
        const scriptStart = improvedHTML.indexOf('<script>') + 8;
        const scriptEnd = improvedHTML.indexOf('</script>');
        
        const beforeScript = improvedHTML.substring(0, scriptStart);
        const afterScript = improvedHTML.substring(scriptEnd);
        
        improvedHTML = beforeScript + improvedScript + `
        
        // Rest der original Funktionen...
        function updateDisplay(data) {
            const { song, mood, settings, showDisplay } = data;
            
            console.log('🎵 Display update:', { 
                song: song?.title, 
                mood: mood?.name, 
                showDisplay,
                timestamp: data.timestamp 
            });
            
            const isNewSong = !currentSong || 
                currentSong.id !== song?.id || 
                currentSong.title !== song?.title;

            currentSong = song;
            currentMood = mood;

            if (song && mood && showDisplay) {
                updateContent(song, mood);
                updateMoodStyling(mood);
                
                if (isNewSong || !isVisible) {
                    showDisplayInternal();
                }
            } else if (!showDisplay) {
                hideDisplayInternal();
            }
        }

        function updateContent(song, mood) {
            document.getElementById('songTitle').textContent = song.title || 'Unbekannter Titel';
            document.getElementById('artistName').textContent = song.artist || 'Unbekannter Künstler';
            
            const albumElement = document.getElementById('albumName');
            if (song.album) {
                albumElement.textContent = song.album;
                albumElement.style.display = 'block';
            } else {
                albumElement.style.display = 'none';
            }
            
            updateCover(song, mood);
            
            const moodIndicator = document.getElementById('moodIndicator');
            moodIndicator.textContent = mood.name;
            moodIndicator.style.display = 'block';
        }

        function updateCover(song, mood) {
            const coverImg = document.getElementById('coverImage');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            const background = document.getElementById('background');
            
            let imageUsed = false;
            
            if (song.cover && song.cover !== 'null' && song.cover !== '' && !song.cover.startsWith('blob:')) {
                coverImg.src = song.cover;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.cover})\`;
                imageUsed = true;
            } else if (mood.background && mood.background !== 'null' && mood.background !== '') {
                coverImg.src = mood.background;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${mood.background})\`;
                imageUsed = true;
            }
            
            if (!imageUsed) {
                coverImg.style.display = 'none';
                coverPlaceholder.style.display = 'flex';
                background.style.backgroundImage = 'none';
            }
        }

        function updateMoodStyling(mood) {
            const moodOverlay = document.getElementById('moodOverlay');
            const moodIndicator = document.getElementById('moodIndicator');
            const waveAnimation = document.getElementById('waveAnimation');
            const songDisplay = document.getElementById('songDisplay');
            
            songDisplay.classList.remove('mood-energetic', 'mood-calm', 'mood-dark');
            moodOverlay.classList.remove('pulse-slow', 'pulse-normal', 'pulse-fast');
            
            if (mood.color) {
                const moodColor = mood.color;
                moodOverlay.style.background = \`linear-gradient(135deg, \${moodColor}40, \${moodColor}20)\`;
                moodIndicator.style.background = \`\${moodColor}60\`;
                moodIndicator.style.borderColor = \`\${moodColor}80\`;
                waveAnimation.style.color = moodColor;
            }
            
            if (mood.pulseSpeed) {
                if (mood.pulseSpeed < 1.5) {
                    moodOverlay.classList.add('pulse-fast');
                    songDisplay.classList.add('mood-energetic');
                } else if (mood.pulseSpeed > 2.5) {
                    moodOverlay.classList.add('pulse-slow');
                    songDisplay.classList.add('mood-calm');
                } else {
                    moodOverlay.classList.add('pulse-normal');
                }
            }
            
            if (mood.intensity === 'extreme') {
                waveAnimation.style.display = 'block';
                songDisplay.classList.add('mood-energetic');
            } else if (mood.intensity === 'subtle') {
                songDisplay.classList.add('mood-calm');
            }
        }

        function showDisplayInternal() {
            const display = document.getElementById('songDisplay');
            display.classList.add('visible');
            isVisible = true;
        }

        function hideDisplayInternal() {
            const display = document.getElementById('songDisplay');
            display.classList.remove('visible');
            isVisible = false;
        }

        // Initialisierung
        loadDisplayData();
        setInterval(loadDisplayData, 2000); // Alle 2 Sekunden prüfen
        
        console.log('🎵 Improved Mood Music OBS Display geladen und bereit!');
        updateDebugInfo('Bereit - suche Daten...');
        ` + afterScript;
    }

    // Debug-Status hinzufügen
    if (improvedHTML.includes('</body>')) {
        improvedHTML = improvedHTML.replace('</body>', `
        <div id="debugStatus" style="position: absolute; bottom: 4px; left: 4px; font-size: 10px; color: rgba(255,255,255,0.5); background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">
            Loading...
        </div>
        </body>`);
    }

    return improvedHTML;
  }

  // Test-Methode für Debugging
  async testOBSDataCreation() {
    const testData = {
      song: {
        id: 'test-' + Date.now(),
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        cover: null
      },
      mood: {
        name: 'Test Mood',
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
    
    await this.writeOBSData(testData);
    console.log('🧪 Test OBS data erstellt');
    
    return testData;
  }

  // Hilfsmethode: JSON-Inhalt anzeigen
  showJSONContent() {
    if (!this.currentData) {
      alert('Keine Song-Daten verfügbar. Spiele zuerst einen Song ab.');
      return;
    }
    
    const jsonString = JSON.stringify(this.currentData, null, 2);
    
    const popup = window.open('', '_blank', 'width=700,height=500');
    popup.document.write(`
      <html>
        <head>
          <title>obs-data.json Inhalt</title>
          <style>
            body { font-family: monospace; margin: 20px; }
            textarea { width: 100%; height: 400px; }
            button { padding: 10px 20px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h3>obs-data.json Inhalt:</h3>
          <p><strong>Speichere als:</strong> obs-data.json (im selben Ordner wie die HTML-Datei)</p>
          <textarea readonly>${jsonString}</textarea>
          <br>
          <button onclick="navigator.clipboard.writeText(document.querySelector('textarea').value).then(() => alert('In Zwischenablage kopiert!'))">
            In Zwischenablage kopieren
          </button>
          <button onclick="window.close()">Schließen</button>
        </body>
      </html>
    `);
  }

  // Method to read OBS data (for testing)
  async readOBSData() {
    try {
      // Try localStorage first
      const data = localStorage.getItem('obs-display-data');
      if (data) {
        return JSON.parse(data);
      }
      
      // Try to fetch from public directory
      const response = await fetch('/obs-data.json?t=' + Date.now());
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to read OBS data:', error);
      return null;
    }
  }

  getCurrentData() {
    return this.currentData;
  }

  // Cleanup beim Beenden
  destroy() {
    this.disableAutoUpdate();
    
    if (window.obsDataURL) {
      URL.revokeObjectURL(window.obsDataURL);
      window.obsDataURL = null;
    }
    
    console.log('🧹 OBS Data Writer cleanup abgeschlossen');
  }
}

export default new OBSDataWriter();