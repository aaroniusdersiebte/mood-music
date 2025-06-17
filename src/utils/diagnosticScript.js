// Audio Mixer Diagnose- und Reparatur-Skript
// Ausführen in der Browser-Konsole: diagnosticScript.runFullDiagnosis()

window.diagnosticScript = {
  
  // Hauptdiagnose-Funktion
  async runFullDiagnosis() {
    console.log('🔧 === AUDIO MIXER DIAGNOSE GESTARTET ===');
    
    const results = {
      serviceManager: await this.checkServiceManager(),
      globalStateService: this.checkGlobalStateService(),
      obsService: this.checkOBSService(),
      midiService: this.checkMIDIService(),
      audioDeckService: this.checkAudioDeckService(),
      connections: this.checkConnections(),
      audioSources: this.checkAudioSources()
    };
    
    console.log('📊 === DIAGNOSE-ERGEBNISSE ===');
    console.table(results);
    
    // Automatische Reparatur-Vorschläge
    this.suggestRepairs(results);
    
    return results;
  },

  // Service Manager Check
  async checkServiceManager() {
    const status = {
      available: !!window.serviceManager,
      initialized: window.serviceManager?.initialized || false,
      serviceStates: window.serviceManager?.serviceStates || {}
    };
    
    if (!status.available) {
      console.error('❌ ServiceManager nicht verfügbar!');
      console.log('💡 Lösung: App neu laden oder ServiceManager importieren');
    } else if (!status.initialized) {
      console.warn('⚠️ ServiceManager nicht initialisiert!');
      console.log('💡 Lösung: Warte auf App-Initialisierung oder rufe serviceManager.initializeAllServices() auf');
    } else {
      console.log('✅ ServiceManager OK');
    }
    
    return status;
  },

  // Global State Service Check
  checkGlobalStateService() {
    const status = {
      available: !!window.globalStateService,
      obsConnected: window.globalStateService?.isOBSConnected?.() || false,
      midiConnected: window.globalStateService?.isMIDIConnected?.() || false,
      sourcesCount: window.globalStateService?.getAudioSources?.()?.length || 0,
      mappingsCount: Object.keys(window.globalStateService?.getAudioSourceMappings?.() || {}).length
    };
    
    if (!status.available) {
      console.error('❌ GlobalStateService nicht verfügbar!');
    } else {
      console.log('✅ GlobalStateService verfügbar');
      console.log('📊 Status:', status);
    }
    
    return status;
  },

  // OBS Service Check
  checkOBSService() {
    const globalState = window.globalStateService;
    const obsService = globalState?.services?.obs;
    
    const status = {
      available: !!obsService,
      connected: obsService?.isConnected?.() || false,
      sourcesCount: obsService?.getAudioSources?.()?.length || 0,
      methodsAvailable: {
        connect: typeof obsService?.connect === 'function',
        discoverAudioSources: typeof obsService?.discoverAudioSources === 'function',
        setVolume: typeof obsService?.setVolume === 'function',
        toggleMute: typeof obsService?.toggleMute === 'function'
      }
    };
    
    if (!status.available) {
      console.error('❌ OBS Service nicht verfügbar!');
    } else if (!status.connected) {
      console.warn('⚠️ OBS nicht verbunden!');
    } else {
      console.log('✅ OBS Service OK');
    }
    
    return status;
  },

  // MIDI Service Check
  checkMIDIService() {
    const globalState = window.globalStateService;
    const midiService = globalState?.services?.midi;
    
    const status = {
      available: !!midiService,
      methodsAvailable: {
        startLearning: typeof midiService?.startLearning === 'function',
        stopLearning: typeof midiService?.stopLearning === 'function',
        setMapping: typeof midiService?.setMapping === 'function'
      },
      mappingsCount: Object.keys(midiService?.getAllMappings?.() || {}).length
    };
    
    if (!status.available) {
      console.warn('⚠️ MIDI Service nicht verfügbar (optional)');
    } else {
      console.log('✅ MIDI Service verfügbar');
    }
    
    return status;
  },

  // Audio Deck Service Check
  checkAudioDeckService() {
    const status = {
      available: !!window.audioDeckService,
      initialized: window.audioDeckService?.initialized || false,
      decksCount: window.audioDeckService?.getAllDecks?.()?.length || 0
    };
    
    if (!status.available) {
      console.error('❌ AudioDeckService nicht verfügbar!');
    } else if (!status.initialized) {
      console.warn('⚠️ AudioDeckService nicht initialisiert!');
    } else {
      console.log('✅ AudioDeckService OK');
    }
    
    return status;
  },

  // Verbindungs-Check
  checkConnections() {
    const globalState = window.globalStateService;
    const obsState = globalState?.getOBSState?.() || {};
    const midiState = globalState?.getMIDIState?.() || {};
    
    const status = {
      obs: {
        connected: obsState.connected || false,
        sourcesCount: obsState.sources?.length || 0,
        lastDiscovery: obsState.lastSourceDiscovery || 0
      },
      midi: {
        connected: midiState.connected || false,
        learning: midiState.learning || false,
        lastActivity: midiState.lastActivity || null
      }
    };
    
    console.log('🔗 Verbindungsstatus:', status);
    return status;
  },

  // Audio Sources Check
  checkAudioSources() {
    const globalState = window.globalStateService;
    const sources = globalState?.getAudioSources?.() || [];
    const levels = globalState?.getAllAudioLevels?.() || {};
    
    const status = {
      totalSources: sources.length,
      sourcesWithLevels: Object.keys(levels).length,
      sources: sources.map(s => ({
        name: s.name,
        kind: s.kind,
        volumeDb: s.volumeDb,
        muted: s.muted,
        hasLevels: !!levels[s.name]
      }))
    };
    
    console.log('🎵 Audio Sources:', status);
    return status;
  },

  // Reparatur-Vorschläge
  suggestRepairs(results) {
    console.log('\n🔧 === REPARATUR-VORSCHLÄGE ===');
    
    if (!results.serviceManager.available) {
      console.log('1. ❌ ServiceManager fehlt -> App neu laden');
    } else if (!results.serviceManager.initialized) {
      console.log('1. 🔄 ServiceManager initialisieren:');
      console.log('   await window.serviceManager.initializeAllServices()');
    }
    
    if (!results.connections.obs.connected) {
      console.log('2. 🔗 OBS verbinden:');
      console.log('   await window.serviceManager.connectToOBS("localhost", 4455, "")');
    }
    
    if (results.connections.obs.connected && results.audioSources.totalSources === 0) {
      console.log('3. 🔍 OBS Sources entdecken:');
      console.log('   await window.globalStateService.services.obs.discoverAudioSources()');
    }
    
    if (!results.midiService.available) {
      console.log('4. 🎹 MIDI Service reparieren:');
      console.log('   Überprüfe midiService.js Import in serviceManager.js');
    }
    
    console.log('\n✨ Automatische Reparatur verfügbar:');
    console.log('   diagnosticScript.autoRepair()');
  },

  // Automatische Reparatur
  async autoRepair() {
    console.log('🔧 === AUTOMATISCHE REPARATUR GESTARTET ===');
    
    try {
      // 1. ServiceManager initialisieren
      if (window.serviceManager && !window.serviceManager.initialized) {
        console.log('🔄 Initialisiere ServiceManager...');
        const success = await window.serviceManager.initializeAllServices();
        if (success) {
          console.log('✅ ServiceManager initialisiert');
        } else {
          console.warn('⚠️ ServiceManager-Initialisierung teilweise fehlgeschlagen');
        }
      }
      
      // 2. OBS verbinden
      if (!window.globalStateService?.isOBSConnected?.()) {
        console.log('🔗 Verbinde mit OBS...');
        const obsConnected = await window.serviceManager?.connectToOBS?.('localhost', 4455, '');
        if (obsConnected) {
          console.log('✅ OBS verbunden');
          
          // 3. Sources entdecken
          setTimeout(async () => {
            console.log('🔍 Entdecke Audio Sources...');
            await window.globalStateService.services.obs?.discoverAudioSources?.();
            console.log('✅ Audio Sources entdeckt');
          }, 2000);
        } else {
          console.warn('⚠️ OBS-Verbindung fehlgeschlagen');
        }
      }
      
      console.log('✅ Automatische Reparatur abgeschlossen');
      
      // Neue Diagnose nach Reparatur
      setTimeout(() => {
        this.runFullDiagnosis();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Automatische Reparatur fehlgeschlagen:', error);
    }
  },

  // MIDI Test
  testMIDI() {
    console.log('🎹 === MIDI TEST ===');
    
    const midiService = window.globalStateService?.services?.midi;
    if (!midiService) {
      console.error('❌ MIDI Service nicht verfügbar');
      return false;
    }
    
    console.log('🎯 Starte MIDI Learning Test...');
    const success = midiService.startLearning((message) => {
      console.log('✅ MIDI Learning funktioniert!', message);
      midiService.stopLearning();
    });
    
    if (success) {
      console.log('🎹 Bewege jetzt einen MIDI-Controller oder drücke Q-K auf der Tastatur...');
    } else {
      console.error('❌ MIDI Learning konnte nicht gestartet werden');
    }
    
    return success;
  },

  // OBS Test
  async testOBS() {
    console.log('🎥 === OBS TEST ===');
    
    const obsService = window.globalStateService?.services?.obs;
    if (!obsService) {
      console.error('❌ OBS Service nicht verfügbar');
      return false;
    }
    
    if (!obsService.isConnected()) {
      console.error('❌ OBS nicht verbunden');
      return false;
    }
    
    console.log('🔍 Teste OBS Funktionen...');
    
    // Test source discovery
    await obsService.discoverAudioSources();
    const sources = obsService.getAudioSources();
    console.log('✅ Sources gefunden:', sources.length);
    
    // Test volume control with first source
    if (sources.length > 0) {
      const firstSource = sources[0];
      console.log('🔊 Teste Volume Control mit:', firstSource.name);
      
      const originalVolume = firstSource.volumeDb;
      await obsService.setVolume(firstSource.name, -20);
      
      setTimeout(async () => {
        await obsService.setVolume(firstSource.name, originalVolume);
        console.log('✅ Volume Control funktioniert');
      }, 1000);
    }
    
    return true;
  },

  // Audio Deck Test
  testAudioDecks() {
    console.log('🎛️ === AUDIO DECK TEST ===');
    
    if (!window.audioDeckService) {
      console.error('❌ AudioDeckService nicht verfügbar');
      return false;
    }
    
    const decks = window.audioDeckService.getAllDecks();
    console.log('📊 Verfügbare Decks:', decks.length);
    
    decks.forEach(deck => {
      console.log(`🎵 Deck: ${deck.name} (${deck.sources.length} sources)`);
    });
    
    return true;
  },

  // Event Test
  testEvents() {
    console.log('📡 === EVENT SYSTEM TEST ===');
    
    const globalState = window.globalStateService;
    if (!globalState) {
      console.error('❌ GlobalStateService nicht verfügbar');
      return false;
    }
    
    // Test OBS events
    let obsEventReceived = false;
    globalState.on('obsStateChanged', (state) => {
      obsEventReceived = true;
      console.log('✅ OBS Event empfangen:', state.connected ? 'connected' : 'disconnected');
    });
    
    // Test MIDI events
    let midiEventReceived = false;
    globalState.on('midiStateChanged', (state) => {
      midiEventReceived = true;
      console.log('✅ MIDI Event empfangen:', state.connected ? 'connected' : 'disconnected');
    });
    
    // Test audio level events
    let audioEventReceived = false;
    globalState.on('audioLevelsUpdated', (data) => {
      if (!audioEventReceived) {
        audioEventReceived = true;
        console.log('✅ Audio Level Event empfangen für:', data.sourceName);
      }
    });
    
    console.log('📡 Event Listeners registriert - teste jetzt Verbindungen...');
    return true;
  },

  // Debug Info
  showDebugInfo() {
    console.log('🐛 === DEBUG INFORMATIONEN ===');
    
    const info = {
      window: {
        serviceManager: !!window.serviceManager,
        globalStateService: !!window.globalStateService,
        audioDeckService: !!window.audioDeckService,
        useMoodStore: !!window.useMoodStore
      },
      globalState: window.globalStateService ? {
        obsState: window.globalStateService.getOBSState(),
        midiState: window.globalStateService.getMIDIState(),
        services: Object.keys(window.globalStateService.services || {})
      } : null,
      serviceManager: window.serviceManager ? {
        initialized: window.serviceManager.initialized,
        serviceStates: window.serviceManager.serviceStates
      } : null
    };
    
    console.log('📊 System Info:', info);
    return info;
  }
};

// Auto-run bei Laden
console.log('🔧 Audio Mixer Diagnose-Tool geladen!');
console.log('🚀 Vollständige Diagnose: diagnosticScript.runFullDiagnosis()');
console.log('🔧 Automatische Reparatur: diagnosticScript.autoRepair()');
console.log('🎹 MIDI Test: diagnosticScript.testMIDI()');
console.log('🎥 OBS Test: diagnosticScript.testOBS()');
console.log('🐛 Debug Info: diagnosticScript.showDebugInfo()');
