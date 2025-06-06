import { Howl, Howler } from 'howler';

class AudioService {
  constructor() {
    this.currentHowl = null;
    this.onSongEnd = null;
    this.onProgress = null;
    this.onLoad = null;
    this.onError = null;
  }

  loadSong(song) {
    return new Promise((resolve, reject) => {
      if (this.currentHowl) {
        this.currentHowl.unload();
      }

      // Determine the best audio source
      let audioSrc = song.path;
      
      // If we're in Electron and have an originalPath, use that
      if (song.isElectron && song.originalPath && window.process) {
        audioSrc = song.originalPath;
      }
      
      // If the current path doesn't work (e.g., old blob URL), try alternatives
      if (!audioSrc || audioSrc.startsWith('blob:http://localhost')) {
        if (song.originalPath) {
          audioSrc = song.originalPath;
        } else {
          reject(new Error('No valid audio source available'));
          return;
        }
      }

      this.currentHowl = new Howl({
        src: [audioSrc],
        html5: true,
        volume: 0.8,
        onload: () => {
          this.onLoad?.(song);
          resolve(this.currentHowl);
        },
        onend: () => {
          this.onSongEnd?.(song);
        },
        onerror: (id, error) => {
          console.error('Audio loading error:', error, 'Source:', audioSrc);
          
          // Try fallback if original fails
          if (audioSrc !== song.path && song.path) {
            console.log('Trying fallback source:', song.path);
            this.loadSongFallback(song, song.path).then(resolve).catch(reject);
          } else {
            this.onError?.(error);
            reject(error);
          }
        }
      });
    });
  }

  loadSongFallback(song, fallbackSrc) {
    return new Promise((resolve, reject) => {
      if (this.currentHowl) {
        this.currentHowl.unload();
      }

      this.currentHowl = new Howl({
        src: [fallbackSrc],
        html5: true,
        volume: 0.8,
        onload: () => {
          this.onLoad?.(song);
          resolve(this.currentHowl);
        },
        onend: () => {
          this.onSongEnd?.(song);
        },
        onerror: (id, error) => {
          console.error('Audio loading error (fallback):', error);
          this.onError?.(error);
          reject(error);
        }
      });
    });
  }

  play() {
    if (this.currentHowl) {
      this.currentHowl.play();
      return true;
    }
    return false;
  }

  pause() {
    if (this.currentHowl) {
      this.currentHowl.pause();
      return true;
    }
    return false;
  }

  stop() {
    if (this.currentHowl) {
      this.currentHowl.stop();
      return true;
    }
    return false;
  }

  setVolume(volume) {
    if (this.currentHowl) {
      this.currentHowl.volume(volume);
    }
    Howler.volume(volume);
  }

  seek(position) {
    if (this.currentHowl) {
      this.currentHowl.seek(position);
    }
  }

  getCurrentTime() {
    if (this.currentHowl) {
      return this.currentHowl.seek();
    }
    return 0;
  }

  getDuration() {
    if (this.currentHowl) {
      return this.currentHowl.duration();
    }
    return 0;
  }

  isPlaying() {
    if (this.currentHowl) {
      return this.currentHowl.playing();
    }
    return false;
  }

  onSongEndCallback(callback) {
    this.onSongEnd = callback;
  }

  onProgressCallback(callback) {
    this.onProgress = callback;
  }

  onLoadCallback(callback) {
    this.onLoad = callback;
  }

  onErrorCallback(callback) {
    this.onError = callback;
  }

  destroy() {
    if (this.currentHowl) {
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }
}

export default new AudioService();