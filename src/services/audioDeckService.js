// Audio Deck Service - Manages audio source groupings and deck configurations
// Optimized for EXE/Electron with local file storage
import configService from './configService';
import globalStateService from './globalStateService';

class AudioDeckService {
  constructor() {
    this.audioDecks = new Map();
    this.deckSourceMappings = new Map();
    this.initialized = false;
    this.listeners = new Map();
    
    // Delayed initialization to avoid circular dependency issues
    setTimeout(() => {
      this.initializeService();
    }, 100);
  }

  async initializeService() {
    try {
      console.log('AudioDeckService: Initializing...');
      
      // Load audio decks configuration
      await this.loadAudioDecks();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      console.log('AudioDeckService: Initialized with', this.audioDecks.size, 'audio decks');
      
      // Notify about initialization
      this.emit('audioDecksInitialized', { decks: Array.from(this.audioDecks.values()) });
      
    } catch (error) {
      console.error('AudioDeckService: Failed to initialize:', error);
      this.createDefaultDecks();
      this.initialized = true;
    }
  }

  setupEventListeners() {
    // Listen to OBS state changes to update source availability
    try {
      if (globalStateService && typeof globalStateService.on === 'function') {
        globalStateService.on('obsStateChanged', this.handleOBSStateChange.bind(this));
        globalStateService.on('sourcesDiscovered', this.handleSourcesDiscovered.bind(this));
        console.log('AudioDeckService: Event listeners setup successfully');
      } else {
        console.warn('AudioDeckService: globalStateService not ready, retrying in 500ms');
        setTimeout(() => this.setupEventListeners(), 500);
      }
    } catch (error) {
      console.error('AudioDeckService: Failed to setup event listeners:', error);
      // Retry after a delay
      setTimeout(() => this.setupEventListeners(), 1000);
    }
  }

  async loadAudioDecks() {
    try {
      // Wait for configService to be initialized
      let attempts = 0;
      while (!configService.initialized && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      const audioConfig = configService.getAudioDecksConfig() || {};
      
      // Load audio decks
      if (audioConfig.decks) {
        Object.entries(audioConfig.decks).forEach(([deckId, deckData]) => {
          this.audioDecks.set(deckId, {
            ...deckData,
            id: deckId,
            sources: deckData.sources || [],
            createdAt: deckData.createdAt || Date.now(),
            updatedAt: deckData.updatedAt || Date.now()
          });
        });
      }
      
      // Load source mappings
      if (audioConfig.sourceMappings) {
        Object.entries(audioConfig.sourceMappings).forEach(([sourceId, deckId]) => {
          this.deckSourceMappings.set(sourceId, deckId);
        });
      }
      
      console.log('AudioDeckService: Loaded', this.audioDecks.size, 'audio decks');
      
    } catch (error) {
      console.error('AudioDeckService: Failed to load audio decks:', error);
      throw error;
    }
  }

  async saveAudioDecks() {
    try {
      const audioConfig = {
        decks: {},
        sourceMappings: {},
        version: '1.0',
        lastUpdated: Date.now()
      };
      
      // Convert decks Map to object
      this.audioDecks.forEach((deck, deckId) => {
        audioConfig.decks[deckId] = {
          ...deck,
          updatedAt: Date.now()
        };
      });
      
      // Convert source mappings Map to object
      this.deckSourceMappings.forEach((deckId, sourceId) => {
        audioConfig.sourceMappings[sourceId] = deckId;
      });
      
      await configService.setAudioDecksConfig(audioConfig);
      console.log('AudioDeckService: Saved audio decks configuration');
      
    } catch (error) {
      console.error('AudioDeckService: Failed to save audio decks:', error);
      throw error;
    }
  }

  createDefaultDecks() {
    console.log('AudioDeckService: Creating default audio decks...');
    
    const defaultDecks = [
      {
        id: 'main-output',
        name: 'Main Output',
        description: 'Primary audio output sources',
        color: 'green',
        icon: 'speaker',
        orientation: 'vertical',
        showMeters: true,
        sources: [],
        position: { x: 0, y: 0 },
        size: { width: 280, height: 400 },
        isDefault: true
      },
      {
        id: 'microphones',
        name: 'Microphones',
        description: 'All microphone inputs',
        color: 'blue',
        icon: 'mic',
        orientation: 'vertical',
        showMeters: true,
        sources: [],
        position: { x: 300, y: 0 },
        size: { width: 280, height: 300 }
      },
      {
        id: 'media-sources',
        name: 'Media Sources',
        description: 'Music, game audio, and media',
        color: 'purple',
        icon: 'music',
        orientation: 'vertical',
        showMeters: true,
        sources: [],
        position: { x: 600, y: 0 },
        size: { width: 280, height: 350 }
      }
    ];
    
    defaultDecks.forEach(deck => {
      this.audioDecks.set(deck.id, {
        ...deck,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    });
    
    this.saveAudioDecks();
  }

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('AudioDeckService: Event callback error:', error);
        }
      });
    }
  }

  // Deck Management
  createAudioDeck(deckData) {
    const deckId = deckData.id || `deck-${Date.now()}`;
    
    const newDeck = {
      id: deckId,
      name: deckData.name || 'New Audio Deck',
      description: deckData.description || '',
      color: deckData.color || 'blue',
      icon: deckData.icon || 'volume',
      orientation: deckData.orientation || 'vertical',
      showMeters: deckData.showMeters !== false,
      sources: [],
      position: deckData.position || this.findFreePosition(),
      size: deckData.size || { width: 280, height: 400 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false
    };
    
    this.audioDecks.set(deckId, newDeck);
    this.saveAudioDecks();
    
    console.log('AudioDeckService: Created audio deck:', deckId);
    this.emit('deckCreated', { deck: newDeck });
    
    return newDeck;
  }

  updateAudioDeck(deckId, updates) {
    if (!this.audioDecks.has(deckId)) {
      console.error('AudioDeckService: Deck not found:', deckId);
      return null;
    }
    
    const deck = this.audioDecks.get(deckId);
    const updatedDeck = {
      ...deck,
      ...updates,
      id: deckId, // Ensure ID is not overwritten
      updatedAt: Date.now()
    };
    
    this.audioDecks.set(deckId, updatedDeck);
    this.saveAudioDecks();
    
    console.log('AudioDeckService: Updated audio deck:', deckId);
    this.emit('deckUpdated', { deck: updatedDeck });
    
    return updatedDeck;
  }

  deleteAudioDeck(deckId) {
    if (!this.audioDecks.has(deckId)) {
      console.error('AudioDeckService: Deck not found:', deckId);
      return false;
    }
    
    const deck = this.audioDecks.get(deckId);
    
    // Don't allow deletion of default decks
    if (deck.isDefault) {
      console.warn('AudioDeckService: Cannot delete default deck:', deckId);
      return false;
    }
    
    // Remove source mappings
    const sourcesToRemove = [];
    this.deckSourceMappings.forEach((mappedDeckId, sourceId) => {
      if (mappedDeckId === deckId) {
        sourcesToRemove.push(sourceId);
      }
    });
    
    sourcesToRemove.forEach(sourceId => {
      this.deckSourceMappings.delete(sourceId);
    });
    
    this.audioDecks.delete(deckId);
    this.saveAudioDecks();
    
    console.log('AudioDeckService: Deleted audio deck:', deckId);
    this.emit('deckDeleted', { deckId, removedSources: sourcesToRemove });
    
    return true;
  }

  // Source Management
  addSourceToDeck(sourceId, deckId) {
    if (!this.audioDecks.has(deckId)) {
      console.error('AudioDeckService: Deck not found:', deckId);
      return false;
    }
    
    const deck = this.audioDecks.get(deckId);
    
    // Remove source from previous deck if mapped
    this.removeSourceFromAllDecks(sourceId);
    
    // Add to new deck
    if (!deck.sources.includes(sourceId)) {
      deck.sources.push(sourceId);
      this.deckSourceMappings.set(sourceId, deckId);
      
      deck.updatedAt = Date.now();
      this.audioDecks.set(deckId, deck);
      this.saveAudioDecks();
      
      console.log('AudioDeckService: Added source', sourceId, 'to deck', deckId);
      this.emit('sourceAddedToDeck', { sourceId, deckId, deck });
      
      return true;
    }
    
    return false;
  }

  removeSourceFromDeck(sourceId, deckId) {
    if (!this.audioDecks.has(deckId)) {
      console.error('AudioDeckService: Deck not found:', deckId);
      return false;
    }
    
    const deck = this.audioDecks.get(deckId);
    const sourceIndex = deck.sources.indexOf(sourceId);
    
    if (sourceIndex > -1) {
      deck.sources.splice(sourceIndex, 1);
      this.deckSourceMappings.delete(sourceId);
      
      deck.updatedAt = Date.now();
      this.audioDecks.set(deckId, deck);
      this.saveAudioDecks();
      
      console.log('AudioDeckService: Removed source', sourceId, 'from deck', deckId);
      this.emit('sourceRemovedFromDeck', { sourceId, deckId, deck });
      
      return true;
    }
    
    return false;
  }

  removeSourceFromAllDecks(sourceId) {
    let removedFrom = [];
    
    this.audioDecks.forEach((deck, deckId) => {
      const sourceIndex = deck.sources.indexOf(sourceId);
      if (sourceIndex > -1) {
        deck.sources.splice(sourceIndex, 1);
        deck.updatedAt = Date.now();
        removedFrom.push(deckId);
      }
    });
    
    if (removedFrom.length > 0) {
      this.deckSourceMappings.delete(sourceId);
      this.saveAudioDecks();
      
      console.log('AudioDeckService: Removed source', sourceId, 'from decks:', removedFrom);
      this.emit('sourceRemovedFromAllDecks', { sourceId, deckIds: removedFrom });
    }
    
    return removedFrom;
  }

  // Auto-assignment based on source types
  autoAssignSources(sources) {
    console.log('AudioDeckService: Auto-assigning', sources.length, 'sources to decks');
    
    sources.forEach(source => {
      const sourceName = source.name.toLowerCase();
      const sourceKind = (source.kind || '').toLowerCase();
      let targetDeckId = null;
      
      // Smart assignment logic
      if (sourceName.includes('mic') || sourceName.includes('microphone') || 
          sourceKind.includes('input') || sourceKind.includes('dshow_input')) {
        targetDeckId = 'microphones';
      }
      else if (sourceName.includes('desktop') || sourceName.includes('speaker') || 
               sourceName.includes('system') || sourceKind.includes('wasapi_output')) {
        targetDeckId = 'main-output';
      }
      else if (sourceName.includes('game') || sourceName.includes('music') || 
               sourceName.includes('media') || sourceName.includes('discord') ||
               sourceName.includes('spotify') || sourceName.includes('browser')) {
        targetDeckId = 'media-sources';
      }
      else {
        // Default to main output
        targetDeckId = 'main-output';
      }
      
      if (targetDeckId && this.audioDecks.has(targetDeckId)) {
        this.addSourceToDeck(source.name, targetDeckId);
      }
    });
    
    console.log('AudioDeckService: Auto-assignment completed');
    this.emit('sourcesAutoAssigned', { sources, deckMappings: Object.fromEntries(this.deckSourceMappings) });
  }

  // Event handlers for OBS state changes
  handleOBSStateChange(state) {
    if (state.connected && state.sources) {
      console.log('AudioDeckService: OBS connected, updating source assignments');
      
      // Filter audio sources
      const audioSources = state.sources.filter(source => {
        const kind = source.kind || source.inputKind || '';
        return kind.includes('audio') || 
               kind.includes('wasapi') || 
               kind.includes('pulse') ||
               kind === 'coreaudio_input_capture' ||
               kind === 'coreaudio_output_capture';
      });
      
      // Auto-assign new sources that aren't mapped yet
      const unmappedSources = audioSources.filter(source => 
        !this.deckSourceMappings.has(source.name)
      );
      
      if (unmappedSources.length > 0) {
        console.log('AudioDeckService: Found', unmappedSources.length, 'unmapped sources');
        this.autoAssignSources(unmappedSources);
      }
    }
  }

  handleSourcesDiscovered(sources) {
    // Filter for audio sources
    const audioSources = sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
    
    if (audioSources.length > 0) {
      console.log('AudioDeckService: Discovered', audioSources.length, 'audio sources');
      
      // Auto-assign unmapped sources
      const unmappedSources = audioSources.filter(source => 
        !this.deckSourceMappings.has(source.name)
      );
      
      if (unmappedSources.length > 0) {
        this.autoAssignSources(unmappedSources);
      }
    }
  }

  // Utility methods
  findFreePosition() {
    const existingPositions = Array.from(this.audioDecks.values()).map(deck => deck.position);
    let x = 20, y = 20;
    const step = 300;
    
    // Simple position finding - can be enhanced
    while (existingPositions.some(pos => 
      Math.abs(pos.x - x) < 100 && Math.abs(pos.y - y) < 100
    )) {
      x += step;
      if (x > 1000) {
        x = 20;
        y += step;
      }
    }
    
    return { x, y };
  }

  // Getters
  getAllDecks() {
    return Array.from(this.audioDecks.values());
  }

  getDeck(deckId) {
    return this.audioDecks.get(deckId) || null;
  }

  getSourceDeck(sourceId) {
    const deckId = this.deckSourceMappings.get(sourceId);
    return deckId ? this.audioDecks.get(deckId) : null;
  }

  getUnmappedSources(allSources) {
    return allSources.filter(source => !this.deckSourceMappings.has(source.name));
  }

  getDeckSources(deckId) {
    const deck = this.audioDecks.get(deckId);
    return deck ? deck.sources : [];
  }

  // Statistics
  getStats() {
    const totalDecks = this.audioDecks.size;
    const totalMappedSources = this.deckSourceMappings.size;
    const deckStats = {};
    
    this.audioDecks.forEach((deck, deckId) => {
      deckStats[deckId] = {
        sourceCount: deck.sources.length,
        lastUpdated: deck.updatedAt
      };
    });
    
    return {
      totalDecks,
      totalMappedSources,
      deckStats
    };
  }

  // Cleanup
  destroy() {
    this.listeners.clear();
    this.audioDecks.clear();
    this.deckSourceMappings.clear();
    
    // Remove global state listeners safely
    try {
      if (globalStateService && typeof globalStateService.off === 'function') {
        globalStateService.off('obsStateChanged', this.handleOBSStateChange);
        globalStateService.off('sourcesDiscovered', this.handleSourcesDiscovered);
      }
    } catch (error) {
      console.error('AudioDeckService: Error during cleanup:', error);
    }
    
    console.log('AudioDeckService: Destroyed');
  }
}

// Singleton instance
const audioDeckService = new AudioDeckService();

// Global access for debugging
if (typeof window !== 'undefined') {
  window.audioDeckService = audioDeckService;
}

export default audioDeckService;
