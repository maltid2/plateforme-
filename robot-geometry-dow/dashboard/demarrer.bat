@echo off
REM Démarre le tableau de bord Geometry Dow (à lancer au démarrage de Windows via le Planificateur de tâches)
cd /d "%~dp0"
node src\server.js
