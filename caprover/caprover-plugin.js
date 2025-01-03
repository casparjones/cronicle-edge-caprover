#!/usr/bin/env node

// CapRover Plugin for Cronicle
// Ermöglicht das Ausführen von Befehlen in Docker-Containern basierend auf einem Präfix
// Job-Parameter: container_prefix, script, interpreter

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Setup stdin / stdout streams
process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

// JSON-Stream-Funktionalität mit Standard-Node.js-Modulen nachgebaut
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let buffer = '';
rl.on('line', (line) => {
    buffer += line;
    try {
        const job = JSON.parse(buffer);
        processJob(job);
        buffer = '';
    } catch (e) {
        // Warten auf vollständige JSON-Daten
    }
});

function sendResponse(response) {
    console.log(JSON.stringify(response));
}

async function processJob(job) {
    const params = job.params;
    const containerPrefix = params.container_prefix;
    const script = params.script;

    const print = (text) => {
        fs.appendFileSync(job.log_file, text);
    };

    if (!containerPrefix) {
        sendResponse({ complete: 1, code: 1, description: "Fehlender Parameter: container_prefix" });
        return;
    }

    if (!script) {
        sendResponse({ complete: 1, code: 1, description: "Fehlender Parameter: script" });
        return;
    }

    try {
        // Container suchen
        const container = execSync(
            `docker ps --filter \"name=${containerPrefix}\" --format \"{{.Names}}\" | head -n 1`,
            { encoding: 'utf-8' }
        ).trim();

        if (container) {
            print(`Gefundener Container: ${container}\n`);

            // Standard-Temp-Verzeichnis im Container abrufen
            const tempDir = execSync(
                `docker exec "${container}" sh -c \"echo \$TMPDIR || echo /tmp\"`,
                { encoding: 'utf-8' }
            ).trim();

            // Bin-Verzeichnis im Temp-Verzeichnis erstellen, falls nicht vorhanden
            const binDir = `${tempDir}/bin`;
            execSync(`docker exec "${container}" mkdir -p ${binDir}`);

            // Pfad für das temporäre Script mit .sh-Erweiterung
            const tempScriptPath = `${binDir}/temp-script-${Date.now()}.sh`;

            // Prüfen, ob das Script eine Shebang enthält
            const hasShebang = script.startsWith("#!");

            if (hasShebang) {
                // Temporäre Datei erstellen
                fs.writeFileSync(tempScriptPath, script);

                // Datei in den Container kopieren und ausführbar machen
                execSync(`docker cp ${tempScriptPath} ${container}:${tempScriptPath}`);
                execSync(`docker exec "${container}" chmod +x ${tempScriptPath}`);

                // Script ausführen
                execSync(`docker exec "${container}" ${tempScriptPath}`, { stdio: 'inherit' });

                // Temporäre Datei löschen
                execSync(`docker exec "${container}" rm -f ${tempScriptPath}`);
                fs.unlinkSync(tempScriptPath);
            } else {
                // Als Standard-Shell-Befehl ausführen
                const escapedScript = script.replace(/"/g, '\\"').replace(/\$/g, '\\$');
                execSync(`docker exec -i "${container}" sh -c \"${escapedScript}\"`, { stdio: 'inherit' });
            }

            sendResponse({ complete: 1, code: 0, description: "Befehl erfolgreich ausgeführt." });
        } else {
            print(`Kein Container mit dem Präfix '${containerPrefix}' gefunden!\n`);
            sendResponse({ complete: 1, code: 1, description: `Kein Container mit dem Präfix '${containerPrefix}' gefunden.` });
        }
    } catch (error) {
        print(`Fehler beim Ausführen des Befehls: ${error.message}\n`);
        sendResponse({ complete: 1, code: 1, description: `Fehler: ${error.message}` });
    }
}
