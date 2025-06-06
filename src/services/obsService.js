// Browser-safe OBS service that uses IPC in Electron
class OBSService {
  constructor() {
    this.currentPort = 3001;
    this.currentSong = null;
    this.currentMood = null;
    this.displayTimeout = null;
    this.isRunning = false;
    this.isElectron = window.process && window.process.type;
    this.connectionCount = 0;
  }

  async startServer(port = 3001) {
    this.currentPort = port;
    
    if (this.isElectron && window.electronAPI) {
      // Use Electron IPC to start server in main process
      try {
        const result = await window.electronAPI.startOBSServer(port);
        this.isRunning = result.success;
        console.log('OBS Server started via Electron:', result);
        return port;
      } catch (error) {
        console.error('Failed to start OBS server:', error);
        throw error;
      }
    } else {
      // Browser fallback - simulate server
      this.isRunning = true;
      console.log(`OBS Service simulated on http://localhost:${port}`);
      
      // Store data for browser source access
      this.storeOBSData({ 
        song: this.currentSong, 
        mood: this.currentMood, 
        settings: {} 
      });
      
      return port;
    }
  }

  async stopServer() {
    if (this.isElectron && window.electronAPI) {
      try {
        await window.electronAPI.stopOBSServer();
        console.log('OBS Server stopped via Electron');
      } catch (error) {
        console.error('Failed to stop OBS server:', error);
      }
    }
    
    this.isRunning = false;
    
    if (this.displayTimeout) {
      clearTimeout(this.displayTimeout);
      this.displayTimeout = null;
    }
  }

  updateCurrentSong(song, mood, settings = {}) {
    this.currentSong = song;
    this.currentMood = mood;

    // Send via Electron IPC if available
    if (this.isElectron && window.electronAPI) {
      window.electronAPI.updateOBSSong({
        song,
        mood,
        settings
      }).catch(console.error);
    }

    // Store in localStorage/sessionStorage for browser source access
    this.storeOBSData({ song, mood, settings });

    console.log('Updated OBS with song:', song?.title);

    // Handle display timeout
    if (settings.obsDisplayDuration && !settings.obsAlwaysShow) {
      if (this.displayTimeout) {
        clearTimeout(this.displayTimeout);
      }
      
      this.displayTimeout = setTimeout(() => {
        this.hideSongDisplay();
      }, settings.obsDisplayDuration);
    }
  }

  hideSongDisplay() {
    if (this.isElectron && window.electronAPI) {
      window.electronAPI.hideOBSDisplay().catch(console.error);
    }

    // Clear stored data
    this.storeOBSData({ song: null, mood: null, settings: {} });
  }

  storeOBSData(data) {
    // Store data for browser source access
    try {
      const storeData = {
        ...data,
        timestamp: Date.now(),
        port: this.currentPort
      };
      
      // Try sessionStorage first, fallback to localStorage
      try {
        sessionStorage.setItem('obs-current-data', JSON.stringify(storeData));
      } catch {
        localStorage.setItem('obs-current-data', JSON.stringify(storeData));
      }
    } catch (error) {
      console.error('Error storing OBS data:', error);
    }
  }

  getStoredOBSData() {
    try {
      // Try sessionStorage first, fallback to localStorage
      let data;
      try {
        data = sessionStorage.getItem('obs-current-data');
      } catch {
        data = localStorage.getItem('obs-current-data');
      }
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving OBS data:', error);
      return null;
    }
  }

  generateOBSHTML() {
    const port = this.currentPort;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mood Music - OBS Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: transparent;
            overflow: hidden;
            width: 400px;
            height: 120px;
        }

        .song-display {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 12px;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .song-display.visible {
            opacity: 1;
            transform: translateY(0);
        }

        .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            filter: blur(20px) brightness(0.3);
            transform: scale(1.1);
        }

        .mood-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.6;
            mix-blend-mode: overlay;
        }

        .content {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            height: 100%;
            padding: 16px;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
        }

        .cover {
            width: 80px;
            height: 80px;
            border-radius: 8px;
            overflow: hidden;
            flex-shrink: 0;
            background: #333;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .cover-placeholder {
            color: #666;
            font-size: 24px;
        }

        .info {
            margin-left: 16px;
            color: white;
            flex: 1;
            overflow: hidden;
        }

        .title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .artist {
            font-size: 14px;
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .mood-indicator {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
            color: white;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .connection-status {
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22c55e;
            transition: all 0.3s ease;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }

        @keyframes pulse-fast {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.08); opacity: 1; }
        }

        .pulse-slow { animation: pulse 2.5s ease-in-out infinite; }
        .pulse-normal { animation: pulse 1.5s ease-in-out infinite; }
        .pulse-fast { animation: pulse-fast 0.8s ease-in-out infinite; }
    </style>
</head>
<body>
    <div id="songDisplay" class="song-display">
        <div id="background" class="background"></div>
        <div id="moodOverlay" class="mood-overlay"></div>
        <div class="content">
            <div class="cover">
                <img id="coverImage" src="" alt="Album Cover" style="display: none;">
                <div id="coverPlaceholder" class="cover-placeholder">♪</div>
            </div>
            <div class="info">
                <div id="songTitle" class="title">No Song Playing</div>
                <div id="artistName" class="artist">Waiting for Mood Music...</div>
            </div>
        </div>
        <div id="moodIndicator" class="mood-indicator" style="display: none;"></div>
        <div id="connectionStatus" class="connection-status"></div>
    </div>

    <script>
        function loadFromStorage() {
            try {
                // Try sessionStorage first, fallback to localStorage
                let data;
                try {
                    data = sessionStorage.getItem('obs-current-data');
                } catch {
                    data = localStorage.getItem('obs-current-data');
                }
                
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed.song && parsed.mood) {
                        updateDisplay(parsed);
                        return true;
                    }
                }
            } catch (error) {
                console.log('Error loading from storage:', error);
            }
            return false;
        }

        function updateDisplay(data) {
            const { song, mood, settings } = data;
            
            if (!song || !mood) {
                hideDisplay();
                return;
            }

            console.log('Updating display with:', song.title, 'by', song.artist);

            // Update content
            document.getElementById('songTitle').textContent = song.title || 'Unknown Title';
            document.getElementById('artistName').textContent = song.artist || 'Unknown Artist';
            
            // Update cover
            const coverImg = document.getElementById('coverImage');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            
            if (song.cover) {
                coverImg.src = song.cover;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                document.getElementById('background').style.backgroundImage = 'url(' + song.cover + ')';
            } else {
                coverImg.style.display = 'none';
                coverPlaceholder.style.display = 'flex';
                document.getElementById('background').style.backgroundImage = 'none';
            }

            // Update mood styling
            const moodOverlay = document.getElementById('moodOverlay');
            const moodIndicator = document.getElementById('moodIndicator');
            
            if (mood.color) {
                moodOverlay.style.background = 'linear-gradient(135deg, ' + mood.color + '40, ' + mood.color + '20)';
                moodIndicator.style.background = mood.color + '60';
                moodIndicator.style.borderColor = mood.color + '80';
            }
            
            moodIndicator.textContent = mood.name;
            moodIndicator.style.display = 'block';

            // Apply animation based on mood settings
            moodOverlay.className = 'mood-overlay';
            
            if (mood.pulseSpeed < 1) {
                moodOverlay.classList.add('pulse-fast');
            } else if (mood.pulseSpeed > 2) {
                moodOverlay.classList.add('pulse-slow');
            } else {
                moodOverlay.classList.add('pulse-normal');
            }

            showDisplay();
        }

        function showDisplay() {
            document.getElementById('songDisplay').classList.add('visible');
        }

        function hideDisplay() {
            document.getElementById('songDisplay').classList.remove('visible');
        }

        // Initial load
        loadFromStorage();
        
        // Listen for storage changes (when Mood Music updates)
        window.addEventListener('storage', function(e) {
            if (e.key === 'obs-current-data') {
                loadFromStorage();
            }
        });
        
        // Check storage periodically for updates
        setInterval(loadFromStorage, 1000);
    </script>
</body>
</html>`;
  }

  getServerURL() {
    return `http://localhost:${this.currentPort}`;
  }

  isServerRunning() {
    return this.isRunning;
  }

  getConnectionCount() {
    return this.connectionCount;
  }

  // Download OBS HTML file
  downloadOBSFile() {
    const html = this.generateOBSHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mood-music-obs.html';
    a.click();
    
    URL.revokeObjectURL(url);
  }
}

export default new OBSService();