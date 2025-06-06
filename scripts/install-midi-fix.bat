@echo off
echo 🎹 MIDI-Build-Fix wird installiert...

echo.
echo 1. Installiere CRACO und Polyfills...
call npm install @craco/craco --save-dev
call npm install stream-browserify path-browserify os-browserify crypto-browserify buffer process --save-dev

echo.
echo 2. Backup package.json...
copy package.json package.json.backup

echo.
echo 3. MIDI Service wird auf browser-safe umgestellt...

echo.
echo 4. Build-Test...
call npm run build-fix

echo.
echo ✅ MIDI-Build-Fix installiert!
echo.
echo NÄCHSTE SCHRITTE:
echo 1. npm run build-fix  (für Test)
echo 2. npm run dist       (für exe)
echo.
pause