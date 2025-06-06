# Mood Music - Streaming-optimierte Musik-App mit OBS Integration

## 🎵 Was ist neu?

Dein Mood Music Programm wurde komplett überarbeitet und erweitert:

### ✨ Neue Features
- **🎛️ MIDI Learning im Audio Mixer** - Schnell MIDI-Controller zu einzelnen Spuren zuordnen
- **👁️ Spuren Ein-/Ausblenden** - Audio Mixer aufräumen und fokussieren
- **📊 Verbesserte Pegelvisualisierung** - Live Audio-Meter mit Peak-Anzeige
- **🔗 Nur OBS WebSocket** - Vereinfachte, zuverlässigere OBS Integration
- **📺 Automatische Song-Anzeige** - Song-Wechsel werden automatisch in OBS angezeigt
- **💿 EXE-Erstellung** - Einfacher Build-Prozess für portable Anwendung

## 🚀 Schnellstart

### 1. EXE erstellen
```bash
# Einfach doppelklicken:
build-exe.bat
```
Die fertige EXE findest du im `dist/` Ordner!

### 2. Setup ausführen
```bash
# Für geführte Einrichtung:
quick-setup.bat
```

### 3. Manueller Start (Entwicklung)
```bash
npm install
npm start
```

## 🎛️ Audio Mixer - Neue Funktionen

### MIDI Learning
1. **Spur auswählen**: Gehe zum Audio Mixer Tab
2. **Learning starten**: Klicke "Learn Vol" (Lautstärke) oder "Learn" (Mute)
3. **Controller bewegen**: Bewege einen Regler/Button auf deinem MIDI-Controller
4. **Automatische Zuordnung**: Die Verbindung wird sofort hergestellt

**Features:**
- ✅ Live-Anzeige während Learning (blinkt)
- ✅ Automatische Speicherung der Zuordnungen
- ✅ Sofortige Funktionalität nach Learning
- ✅ Separate Zuordnung für Volume und Mute pro Spur

### Spuren-Management
- **Ausblenden**: Klicke das Auge-Symbol 👁️ neben jeder Spur
- **Alle ausblenden**: Verwende den "Hide All" Button im Header
- **Alle einblenden**: Klicke "Show All" Button
- **Versteckte Spuren**: Werden in separater Box angezeigt

### Verbesserte Visualisierung
- **Echtzeit-Meter**: Live Audio-Level von OBS
- **Peak-Anzeige**: Kurzzeitige Spitzenwerte werden gehalten
- **Stereo-Anzeige**: Separate L/R Kanäle
- **Farbverlauf**: Grün → Gelb → Rot je nach Pegel

## 📺 OBS Integration - Vereinfacht

### Automatische Song-Anzeige
**Setup:**
1. OBS öffnen → Tools → WebSocket Server Settings
2. "Enable WebSocket server" aktivieren
3. Port: 4455, Passwort optional
4. In Mood Music: Settings → OBS WebSocket aktivieren

**Funktionalität:**
- ✅ Song-Wechsel werden automatisch in OBS angezeigt
- ✅ Textquelle "Current Song" wird automatisch erstellt
- ✅ Anpassbares Template in Settings
- ✅ Optional Auto-Hide nach eingestellter Zeit

### Template-Optionen
```
Now Playing: {title}
Artist: {artist}
Mood: {mood}

# Verfügbare Platzhalter:
{title}   - Song-Titel
{artist}  - Künstler  
{album}   - Album
{mood}    - Aktuelle Mood
{genre}   - Genre
{year}    - Jahr
```

## 🎮 MIDI Controller

### Hardware-Controller
**Unterstützte Geräte:**
- Alle USB-MIDI Controller
- Audio-Interfaces mit MIDI
- USB-zu-MIDI Adapter

**Standard-Zuordnung (falls nicht gelernt):**
- **CC 1-8**: Lautstärke (Master, Desktop, Mic, Discord, Browser, Game, Music, Alert)
- **CC 16-23**: Hotkeys (Mood-Wechsel, Play/Pause, Next/Previous, Shuffle, Mute, Sound Effects)

### Keyboard-Simulation (ohne Hardware)
**Lautstärke-Controls:**
- Q, W, E, R, T, Y, U, I (entspricht CC 1-8)

**Hotkeys:**
- A, S, D, F, G, H, J, K (entspricht CC 16-23)

## ⚙️ Einstellungen

### OBS WebSocket
```
Host: localhost (wenn OBS auf gleichem PC)
Port: 4455 (OBS Standard)
Passwort: (optional, aber empfohlen)
```

### Song-Anzeige
```
Text Source: Current Song
Template: Now Playing: {title}\nArtist: {artist}\nMood: {mood}
Always Show: false (Auto-Hide nach 5 Sekunden)
```

### Audio
```
Visualization: true
Smoothing Factor: 0.1 (niedriger = responsiver)
Peak Hold Time: 1000ms
```

## 🛠️ Troubleshooting

### EXE Build schlägt fehl
- **Node.js Version prüfen**: Mindestens v16 erforderlich
- **Speicherplatz**: Mindestens 2GB frei für Build
- **Abhängigkeiten**: `npm install` vor Build ausführen

### OBS WebSocket verbindet nicht
- **OBS Version**: Mindestens OBS 28 für WebSocket v5
- **Port prüfen**: 4455 ist Standard, kann in OBS geändert werden
- **Firewall**: Windows Firewall kann WebSocket blockieren
- **Passwort**: Genau wie in OBS eingestellt eingeben

### MIDI Controller funktioniert nicht
- **Treiber**: Controller-spezifische Treiber installieren
- **Browser**: Chrome/Edge haben beste Web MIDI Unterstützung
- **USB**: Anderen USB-Port probieren
- **Keyboard-Sim**: Q-I und A-K Tasten funktionieren auch ohne Hardware

### Audio-Meter zeigen nichts
- **OBS Quellen**: Audio-Quellen müssen in OBS aktiv sein
- **WebSocket**: Muss verbunden sein für Live-Daten
- **Source Names**: OBS Quellennamen korrekt gemappt

## 📁 Projektstruktur

```
mood music/
├── build-exe.bat          # EXE Build-Skript
├── quick-setup.bat        # Setup-Assistent
├── src/
│   ├── components/
│   │   ├── AudioMixer.js  # 🆕 Erweitert mit MIDI Learning
│   │   ├── MIDIMapping.js # MIDI-Konfiguration
│   │   └── Settings.js    # 🆕 Erweitert mit OBS Song Display
│   ├── services/
│   │   ├── midiService.js        # MIDI-Controller Integration
│   │   └── obsWebSocketService.js # 🆕 Erweitert mit Song Display
│   └── stores/
│       └── moodStore.js   # 🆕 Erweitert mit neuen Settings
├── dist/                  # Output-Ordner für EXE
└── docs/                  # Dokumentation
```

## 🎯 Performance-Tipps

1. **Audio-Quellen optimieren**: Nur benötigte Quellen in OBS aktiv lassen
2. **Versteckte Spuren nutzen**: Nicht benötigte Mixer-Spuren ausblenden
3. **MIDI sparsam verwenden**: Nur aktive Mappings behalten
4. **OBS Settings**: Event-Subscriptions minimal halten

## 🆕 Changelog

### v1.0.0 - Große Überarbeitung
- ✅ MIDI Learning für einzelne Audio-Spuren
- ✅ Spuren Ein-/Ausblenden im Audio Mixer
- ✅ Verbesserte Pegelvisualisierung mit Peak-Hold
- ✅ Vereinfachte OBS Integration nur über WebSocket
- ✅ Automatische Song-Anzeige in OBS
- ✅ EXE-Build-Prozess optimiert
- ✅ Umfangreiche Setup-Assistenten
- ✅ Keyboard-MIDI-Simulation verbessert

### Entfernt
- ❌ Alter OBS HTTP Server (ersetzt durch WebSocket-only)
- ❌ Komplexe OBS-HTML-Downloads (automatisch via WebSocket)

## 🤝 Support

Bei Problemen:
1. `NEUE-FEATURES-DOKUMENTATION.md` lesen
2. `quick-setup.bat` erneut ausführen
3. Konsole auf Fehlermeldungen prüfen
4. OBS und MIDI-Controller neu starten

## 🎉 Viel Spaß!

Dein Mood Music ist jetzt ein professionelles Streaming-Tool mit vollständiger MIDI- und OBS-Integration. Genieße das nahtlose Audio-Mixing und die automatische Song-Anzeige in deinen Streams!
