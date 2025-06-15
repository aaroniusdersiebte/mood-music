// Enhanced Configuration Service - File-based storage for Electron with EXE support
// Prioritizes file-based storage and uses localStorage only as emergency fallback
import { join } from 'path';

class ConfigService {
  constructor() {
    this.isElectron = this.detectElectron();
    this.configDir = this.getConfigDirectory();
    this.configFiles = {
      decks: 'hotkey-decks.json',
      dashboard: 'dashboard-layout.json',
      audioMixer: 'audio-mixer-config.json',
      moods: 'mood-shortcuts.json',
      appSettings: 'app-settings.json'
    };
    this.cache = new Map();
    this.saveQueue = new Map();
    this.initialized = false;
    this.fileSystemAvailable = false;
    
    this.initializeConfig();
  }

  detectElectron() {
    // Check for Electron environment (including EXE builds)
    return (
      typeof window !== 'undefined' && 
      (
        window.electronAPI || 
        window.electron || 
        window.require ||
        (window.process && window.process.type === 'renderer') ||
        (navigator.userAgent && navigator.userAgent.includes('Electron'))
      )
    );
  }

  getConfigDirectory() {
    if (this.isElectron) {
      // Try different Electron API variants for EXE compatibility
      const electronAPI = window.electronAPI || window.electron;
      
      if (electronAPI && electronAPI.getAppDataPath) {
        try {
          const appDataPath = electronAPI.getAppDataPath();
          return join(appDataPath, 'mood-music', 'config');
        } catch (error) {
          console.warn('ConfigService: Could not get app data path:', error.message);
        }
      }
      
      // Fallback for Electron EXE builds
      if (window.process && window.process.env) {
        const userDataPath = window.process.env.APPDATA || window.process.env.HOME;
        if (userDataPath) {
          return join(userDataPath, 'mood-music', 'config');
        }
      }
    }
    
    // Development fallback
    return './config';
  }

  async initializeConfig() {
    try {
      console.log('ConfigService: Initializing for', this.isElectron ? 'Electron/EXE' : 'Web', 'environment');
      console.log('ConfigService: Config directory:', this.configDir);
      
      // Try to establish file system access
      await this.testFileSystemAccess();
      
      // Load all configurations into cache
      await this.loadAllConfigs();
      this.initialized = true;
      
      console.log('ConfigService: Initialized successfully with', this.fileSystemAvailable ? 'file' : 'localStorage', 'storage');
    } catch (error) {
      console.error('ConfigService: Initialization failed:', error);
      // Fallback to localStorage-only mode
      this.fileSystemAvailable = false;
      await this.loadAllConfigs();
      this.initialized = true;
      console.log('ConfigService: Fallback to localStorage mode');
    }
  }

  async testFileSystemAccess() {
    try {
      const electronAPI = window.electronAPI || window.electron;
      
      if (electronAPI && electronAPI.ensureDirectory) {
        await electronAPI.ensureDirectory(this.configDir);
        console.log('ConfigService: File system access confirmed');
        this.fileSystemAvailable = true;
      } else if (electronAPI && electronAPI.writeFile) {
        // Test write access with a temporary file
        const testPath = join(this.configDir, '.test');
        await electronAPI.writeFile(testPath, 'test');
        this.fileSystemAvailable = true;
        console.log('ConfigService: File system access confirmed via write test');
      } else {
        console.log('ConfigService: No Electron file system API available, using localStorage');
        this.fileSystemAvailable = false;
      }
    } catch (error) {
      console.warn('ConfigService: File system test failed:', error.message);
      this.fileSystemAvailable = false;
    }
  }

  async loadAllConfigs() {
    const loadPromises = Object.entries(this.configFiles).map(async ([key, filename]) => {
      try {
        const data = await this.loadConfig(key);
        console.log(`ConfigService: Loaded ${key} config:`, Object.keys(data || {}).length, 'items');
      } catch (error) {
        console.warn(`ConfigService: Could not load ${key} config:`, error.message);
        // Set default empty config
        this.cache.set(key, this.getDefaultConfig(key));
      }
    });

    await Promise.all(loadPromises);
  }

  getDefaultConfig(type) {
    const defaults = {
      decks: {
        main: {
          id: 'main',
          name: 'Main Deck',
          rows: 2,
          cols: 7,
          buttons: this.getDefaultButtons(),
          isMainDeck: true,
          position: { x: 0, y: 0 },
          size: { width: 400, height: 200 }
        }
      },
      dashboard: {
        layout: {
          components: [
            {
              id: 'mood-selector',
              type: 'mood-selector',
              position: { x: 20, y: 20 },
              size: { width: 300, height: 200 },
              visible: true
            },
            {
              id: 'audio-mixer',
              type: 'audio-mixer',
              position: { x: 340, y: 20 },
              size: { width: 250, height: 400 },
              visible: true,
              sources: ['master', 'mic', 'desktop', 'game']
            },
            {
              id: 'main-deck',
              type: 'hotkey-deck',
              position: { x: 20, y: 240 },
              size: { width: 300, height: 150 },
              visible: true,
              deckId: 'main'
            }
          ],
          snapToGrid: true,
          gridSize: 10,
          magneticDocking: true
        }
      },
      audioMixer: {
        visibleSources: ['master', 'mic', 'desktop', 'game'],
        compactMode: false,
        showMeters: true,
        meterUpdateRate: 60
      },
      moods: {
        quickAccess: [],
        favorites: [],
        recentlyUsed: []
      },
      appSettings: {
        theme: 'dark',
        autoSave: true,
        autoSaveInterval: 5000,
        performance: {
          reducedAnimations: false,
          limitFPS: false,
          memoryOptimization: true
        }
      }
    };

    return defaults[type] || {};
  }

  getDefaultButtons() {
    return {
      '0-0': {
        type: 'hotkey',
        action: 'playPause',
        label: 'Play/Pause',
        color: 'blue'
      },
      '0-1': {
        type: 'hotkey',
        action: 'nextSong',
        label: 'Next',
        color: 'blue'
      },
      '0-2': {
        type: 'hotkey',
        action: 'prevSong',
        label: 'Previous',
        color: 'blue'
      },
      '1-0': {
        type: 'volume',
        target: 'master',
        label: 'Master',
        color: 'green'
      },
      '1-1': {
        type: 'volume',
        target: 'mic',
        label: 'Mic',
        color: 'green'
      }
    };
  }

  async loadConfig(type) {
    if (!this.configFiles[type]) {
      throw new Error(`Unknown config type: ${type}`);
    }

    const filePath = join(this.configDir, this.configFiles[type]);
    
    try {
      if (this.fileSystemAvailable) {
        // Try file-based storage first
        const electronAPI = window.electronAPI || window.electron;
        
        if (electronAPI && electronAPI.readFile) {
          const data = await electronAPI.readFile(filePath);
          const parsed = JSON.parse(data);
          this.cache.set(type, parsed);
          console.log(`ConfigService: Loaded ${type} from file`);
          return parsed;
        }
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem(`config_${type}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache.set(type, parsed);
        console.log(`ConfigService: Loaded ${type} from localStorage`);
        return parsed;
      }
      
      throw new Error('No config found');
    } catch (error) {
      if (error.code === 'ENOENT' || error.message.includes('not found') || error.message === 'No config found') {
        // File doesn't exist, create with defaults
        console.log(`ConfigService: Creating default ${type} config`);
        const defaultConfig = this.getDefaultConfig(type);
        await this.saveConfig(type, defaultConfig, true);
        return defaultConfig;
      }
      throw error;
    }
  }

  async saveConfig(type, data, immediate = false) {
    if (!this.configFiles[type]) {
      throw new Error(`Unknown config type: ${type}`);
    }

    // Update cache
    this.cache.set(type, data);

    if (immediate) {
      await this.writeToDisk(type, data);
    } else {
      // Queue for batch save
      this.saveQueue.set(type, data);
      this.debouncedSave();
    }
  }

  async writeToDisk(type, data) {
    const filePath = join(this.configDir, this.configFiles[type]);
    const jsonData = JSON.stringify(data, null, 2);
    
    let success = false;
    
    try {
      if (this.fileSystemAvailable) {
        // Try file-based storage first
        const electronAPI = window.electronAPI || window.electron;
        
        if (electronAPI && electronAPI.writeFile) {
          await electronAPI.writeFile(filePath, jsonData);
          console.log(`ConfigService: Saved ${type} config to file`);
          success = true;
        }
      }
    } catch (error) {
      console.warn(`ConfigService: File save failed for ${type}:`, error.message);
      // Don't throw here, fall back to localStorage
    }
    
    if (!success) {
      // Always save to localStorage as backup
      try {
        localStorage.setItem(`config_${type}`, jsonData);
        console.log(`ConfigService: Saved ${type} config to localStorage${this.fileSystemAvailable ? ' (backup)' : ''}`);
      } catch (error) {
        console.error(`ConfigService: Failed to save ${type} to localStorage:`, error);
        throw error;
      }
    }
  }

  debouncedSave = this.debounce(async () => {
    if (this.saveQueue.size === 0) return;

    const savePromises = Array.from(this.saveQueue.entries()).map(([type, data]) => 
      this.writeToDisk(type, data).catch(error => 
        console.error(`ConfigService: Failed to save ${type}:`, error)
      )
    );

    await Promise.all(savePromises);
    this.saveQueue.clear();
  }, 1000);

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Getters with caching
  getConfig(type) {
    if (!this.initialized) {
      console.warn('ConfigService: Not initialized yet, returning defaults');
      return this.getDefaultConfig(type);
    }
    
    return this.cache.get(type) || this.getDefaultConfig(type);
  }

  getDecks() {
    return this.getConfig('decks');
  }

  getDashboardLayout() {
    return this.getConfig('dashboard');
  }

  getAudioMixerConfig() {
    return this.getConfig('audioMixer');
  }

  getMoodShortcuts() {
    return this.getConfig('moods');
  }

  getAppSettings() {
    return this.getConfig('appSettings');
  }

  // Setters
  async setDecks(decks) {
    await this.saveConfig('decks', decks);
  }

  async setDashboardLayout(layout) {
    await this.saveConfig('dashboard', layout);
  }

  async setAudioMixerConfig(config) {
    await this.saveConfig('audioMixer', config);
  }

  async setMoodShortcuts(shortcuts) {
    await this.saveConfig('moods', shortcuts);
  }

  async setAppSettings(settings) {
    await this.saveConfig('appSettings', settings);
  }

  // Deck Management
  async addDeck(deck) {
    const decks = this.getDecks();
    decks[deck.id] = deck;
    await this.setDecks(decks);
  }

  async updateDeck(deckId, updates) {
    const decks = this.getDecks();
    if (decks[deckId]) {
      decks[deckId] = { ...decks[deckId], ...updates };
      await this.setDecks(decks);
    }
  }

  async deleteDeck(deckId) {
    const decks = this.getDecks();
    if (decks[deckId] && !decks[deckId].isMainDeck) {
      delete decks[deckId];
      await this.setDecks(decks);
      return true;
    }
    return false;
  }

  // Dashboard Component Management
  async addDashboardComponent(component) {
    const dashboard = this.getDashboardLayout();
    dashboard.layout.components.push(component);
    await this.setDashboardLayout(dashboard);
  }

  async updateDashboardComponent(componentId, updates) {
    const dashboard = this.getDashboardLayout();
    const component = dashboard.layout.components.find(c => c.id === componentId);
    if (component) {
      Object.assign(component, updates);
      await this.setDashboardLayout(dashboard);
    }
  }

  async removeDashboardComponent(componentId) {
    const dashboard = this.getDashboardLayout();
    dashboard.layout.components = dashboard.layout.components.filter(c => c.id !== componentId);
    await this.setDashboardLayout(dashboard);
  }

  // Performance optimization
  async compactSave() {
    // Force immediate save of all queued items
    if (this.saveQueue.size > 0) {
      await this.debouncedSave();
    }
  }

  async backup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.configDir, 'backups', timestamp);
    
    try {
      // Use Electron API for directory creation
      if (window.electronAPI && window.electronAPI.ensureDirectory) {
        await window.electronAPI.ensureDirectory(backupDir);
      }
      
      const backupPromises = Object.entries(this.configFiles).map(async ([type, filename]) => {
        const source = join(this.configDir, filename);
        const dest = join(backupDir, filename);
        
        try {
          if (window.electronAPI && window.electronAPI.readFile && window.electronAPI.writeFile) {
            const data = await window.electronAPI.readFile(source);
            await window.electronAPI.writeFile(dest, data);
          } else {
            // Fallback to localStorage backup
            const stored = localStorage.getItem(`config_${type}`);
            if (stored) {
              localStorage.setItem(`backup_${timestamp}_${type}`, stored);
            }
          }
        } catch (error) {
          console.warn(`Could not backup ${filename}:`, error.message);
        }
      });

      await Promise.all(backupPromises);
      console.log('ConfigService: Backup created at:', backupDir);
      return backupDir;
    } catch (error) {
      console.error('ConfigService: Backup failed:', error);
      throw error;
    }
  }

  // Memory optimization
  clearCache() {
    this.cache.clear();
    this.saveQueue.clear();
    console.log('ConfigService: Cache cleared');
  }

  // Cleanup
  async destroy() {
    await this.compactSave();
    this.clearCache();
    console.log('ConfigService: Destroyed');
  }
}

// Singleton instance
const configService = new ConfigService();

// Global access for debugging
if (typeof window !== 'undefined') {
  window.configService = configService;
}

export default configService;
