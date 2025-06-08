// Local HTTP Server for OBS data delivery
class OBSHttpServer {
  constructor() {
    this.server = null;
    this.port = 3003;
    this.currentData = null;
    this.isRunning = false;
    this.isElectron = typeof window !== 'undefined' && window.process && window.process.type;
  }

  async start(port = 3003) {
    this.port = port;
    
    try {
      // If we're in Electron, use the main process to start the server
      if (this.isElectron && window.electronAPI && window.electronAPI.startOBSServer) {
        const result = await window.electronAPI.startOBSServer(port);
        this.isRunning = result.success;
        console.log('🌐 OBS HTTP Server started via Electron on port', port);
        return true;
      }

      // Browser fallback: simulate server
      this.isRunning = true;
      console.log('🌐 OBS HTTP Server simulated on port', port);
      
      return true;
    } catch (error) {
      console.error('Failed to start OBS HTTP server:', error);
      throw error;
    }
  }

  async stop() {
    try {
      if (this.isElectron && window.electronAPI && window.electronAPI.stopOBSServer) {
        await window.electronAPI.stopOBSServer();
      }
      this.isRunning = false;
      console.log('🛑 OBS HTTP Server stopped');
    } catch (error) {
      console.error('Error stopping OBS HTTP server:', error);
    }
  }

  async updateData(data) {
    this.currentData = data;
    
    try {
      // Send data to Electron main process if available
      if (this.isElectron && window.electronAPI && window.electronAPI.updateOBSData) {
        await window.electronAPI.updateOBSData(data);
      }
      
      // Also store in localStorage as fallback
      localStorage.setItem('obs-http-server-data', JSON.stringify(data));
      
      console.log('📡 OBS data updated on HTTP server');
    } catch (error) {
      console.error('Error updating OBS server data:', error);
    }
  }

  getServerURL() {
    return `http://localhost:${this.port}`;
  }

  getDataURL() {
    return `${this.getServerURL()}/obs-data.json`;
  }

  isServerRunning() {
    return this.isRunning;
  }

  // Create a standalone HTML file that connects to this server
  generateOBSHTML(settings = {}) {
    const {
      obsDisplayDuration = 8000,
      obsPreDisplayDuration = 2000,
      obsAlwaysShow = false,
      obsShowCover = true,
      obsAnimationStyle = 'slide',
      obsMoodTransitionDuration = 1500
    } = settings;

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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: transparent;
            overflow: hidden;
            width: 800px;
            height: 200px;
            position: relative;
        }

        .song-display {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 16px;
            overflow: hidden;
            opacity: 0;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(40px)' : obsAnimationStyle === 'scale' ? 'scale(0.8)' : 'translateY(0px)'};
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .song-display.visible {
            opacity: 1;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(0)' : obsAnimationStyle === 'scale' ? 'scale(1)' : 'translateY(0px)'};
        }

        .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            filter: blur(25px) brightness(0.4) saturate(1.2);
            transform: scale(1.2);
            transition: all ${obsMoodTransitionDuration}ms ease;
        }

        .mood-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.7;
            background: linear-gradient(135deg, #4ade8040, #3b82f640);
            transition: all ${obsMoodTransitionDuration}ms ease;
            mix-blend-mode: overlay;
        }

        .content {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            height: 100%;
            padding: 24px;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        ${obsShowCover ? `
        .cover {
            width: 140px;
            height: 140px;
            border-radius: 12px;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #333, #555);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            transition: all 0.4s ease;
        }

        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: all 0.6s ease;
        }

        .cover-placeholder {
            color: #888;
            font-size: 32px;
            opacity: 0.6;
        }
        ` : ''}

        .info {
            margin-left: ${obsShowCover ? '32px' : '0px'};
            color: white;
            flex: 1;
            overflow: hidden;
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1.2;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        .artist {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 12px;
            font-weight: 500;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.4s both;
        }

        .album {
            font-size: 14px;
            opacity: 0.7;
            font-style: italic;
            animation: fadeInUp 0.8s ease 0.6s both;
        }

        .mood-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            animation: fadeInDown 0.8s ease 0.8s both;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .wave-animation {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 8px;
            background: linear-gradient(90deg, transparent, currentColor, transparent);
            opacity: 0.6;
            animation: wave 2s ease-in-out infinite;
        }

        .now-playing {
            position: absolute;
            top: -30px;
            left: 24px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            animation: fadeInDown 0.8s ease both;
        }

        .connection-status {
            position: absolute;
            bottom: 8px;
            right: 8px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 4px;
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes wave {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.02); opacity: 0.9; }
        }

        @keyframes pulse-fast {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.04); opacity: 1; }
        }

        .pulse-slow { animation: pulse 3s ease-in-out infinite; }
        .pulse-normal { animation: pulse 2s ease-in-out infinite; }
        .pulse-fast { animation: pulse-fast 1s ease-in-out infinite; }

        .mood-energetic .mood-overlay { animation: pulse-fast 1.5s ease-in-out infinite; }
        .mood-calm .mood-overlay { animation: pulse 4s ease-in-out infinite; }
        .mood-dark .mood-overlay { animation: pulse 5s ease-in-out infinite; }
    </style>
</head>
<body>
    <div id="songDisplay" class="song-display">
        <div class="now-playing">♪ Now Playing</div>
        <div id="background" class="background"></div>
        <div id="moodOverlay" class="mood-overlay"></div>
        <div class="content">
            ${obsShowCover ? `
            <div class="cover">
                <img id="coverImage" src="" alt="Album Cover" style="display: none;">
                <div id="coverPlaceholder" class="cover-placeholder">♪</div>
            </div>
            ` : ''}
            <div class="info">
                <div id="songTitle" class="title">Mood Music</div>
                <div id="artistName" class="artist">Connecting...</div>
                <div id="albumName" class="album" style="display: none;"></div>
            </div>
        </div>
        <div id="moodIndicator" class="mood-indicator" style="display: none;"></div>
        <div id="waveAnimation" class="wave-animation" style="display: none;"></div>
        <div id="connectionStatus" class="connection-status">Connecting...</div>
    </div>

    <script>
        const SETTINGS = {
            displayDuration: ${obsDisplayDuration},
            preDisplayDuration: ${obsPreDisplayDuration},
            alwaysShow: ${obsAlwaysShow},
            showCover: ${obsShowCover},
            animationStyle: '${obsAnimationStyle}',
            moodTransitionDuration: ${obsMoodTransitionDuration},
            serverPort: ${this.port}
        };

        let currentSong = null;
        let currentMood = null;
        let lastDataTimestamp = 0;
        let isVisible = false;
        let connectionAttempts = 0;
        let maxConnectionAttempts = 10;

        // Update connection status
        function updateConnectionStatus(status) {
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.textContent = status;
            }
        }

        // Load data from HTTP server
        async function loadDisplayData() {
            try {
                connectionAttempts++;
                
                // Try to load from local HTTP server first
                const serverUrl = \`http://localhost:\${SETTINGS.serverPort}/obs-data.json?t=\${Date.now()}\`;
                
                try {
                    const response = await fetch(serverUrl);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = data.timestamp;
                            updateDisplay(data);
                            updateConnectionStatus('Connected');
                            connectionAttempts = 0;
                            return true;
                        }
                    }
                } catch (serverError) {
                    // Server not available, try fallbacks
                }

                // Fallback 1: Try to load from same directory
                try {
                    const response = await fetch('./obs-data.json?t=' + Date.now());
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = data.timestamp;
                            updateDisplay(data);
                            updateConnectionStatus('File Mode');
                            return true;
                        }
                    }
                } catch (error) {
                    // File not available
                }

                // Fallback 2: Try localStorage (same origin only)
                try {
                    const data = localStorage.getItem('obs-http-server-data') || localStorage.getItem('obs-display-data');
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.timestamp > lastDataTimestamp) {
                            lastDataTimestamp = parsed.timestamp;
                            updateDisplay(parsed);
                            updateConnectionStatus('Local Storage');
                            return true;
                        }
                    }
                } catch (e) {
                    // localStorage not available
                }

                // Connection failed
                if (connectionAttempts <= maxConnectionAttempts) {
                    updateConnectionStatus(\`Connecting... (\${connectionAttempts}/\${maxConnectionAttempts})\`);
                } else {
                    updateConnectionStatus('No Data Source');
                    document.getElementById('artistName').textContent = 'Waiting for Mood Music...';
                }

            } catch (error) {
                console.log('Error loading display data:', error);
                updateConnectionStatus('Error');
            }
            return false;
        }

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
            } else if (!showDisplay && !SETTINGS.alwaysShow) {
                hideDisplayInternal();
            }
        }

        function updateContent(song, mood) {
            document.getElementById('songTitle').textContent = song.title || 'Unknown Title';
            document.getElementById('artistName').textContent = song.artist || 'Unknown Artist';
            
            const albumElement = document.getElementById('albumName');
            if (song.album) {
                albumElement.textContent = song.album;
                albumElement.style.display = 'block';
            } else {
                albumElement.style.display = 'none';
            }
            
            if (SETTINGS.showCover) {
                updateCover(song, mood);
            }
            
            const moodIndicator = document.getElementById('moodIndicator');
            moodIndicator.textContent = mood.name;
            moodIndicator.style.display = 'block';
        }

        function updateCover(song, mood) {
            const coverImg = document.getElementById('coverImage');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            const background = document.getElementById('background');
            
            let imageUsed = false;
            
            // Try song cover first
            if (song.cover && song.cover !== 'null' && song.cover !== '' && !song.cover.startsWith('blob:')) {
                coverImg.src = song.cover;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.cover})\`;
                imageUsed = true;
            } 
            // Try mood background as fallback
            else if (song.moodBackground && song.moodBackground !== 'null' && song.moodBackground !== '') {
                coverImg.src = song.moodBackground;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.moodBackground})\`;
                imageUsed = true;
            }
            // Try mood background directly
            else if (mood.background && mood.background !== 'null' && mood.background !== '') {
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
            if (SETTINGS.alwaysShow) return;
            const display = document.getElementById('songDisplay');
            display.classList.remove('visible');
            isVisible = false;
        }

        // Initialize
        if (SETTINGS.alwaysShow) {
            showDisplayInternal();
        }
        
        loadDisplayData();
        setInterval(loadDisplayData, 1000);
        
        console.log('🎵 Mood Music OBS Display loaded with server port', SETTINGS.serverPort);
    </script>
</body>
</html>`;
  }
}

export default new OBSHttpServer();