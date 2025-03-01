#!/usr/bin/env node

// CapRover Plugin for Cronicle
// Ermöglicht das Ausführen von Befehlen in Docker-Containern basierend auf einem Präfix
// Job-Parameter: container_prefix, script, interpreter
// Neue optionale Parameter: copy_source und copy_target im Format "Volume:mountPath"
// Beispiel: copy_source: "captain--redis-redis-data:/backup/*"
//          copy_target: "captain--files-files:/redis/"

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
    const print = (text) => {
        fs.appendFileSync(job.log_file, text);
    };

    // --- Neuer Zweig: Volume Copy ---
    if (params.copy_source && params.copy_target) {
        let copySource = params.copy_source; // erwartet z.B. "captain--redis-redis-data:/backup/*"
        let copyTarget = params.copy_target; // erwartet z.B. "captain--files-files:/redis/"

        let [srcVolume, srcPath] = copySource.split(':');
        let [tgtVolume, tgtPath] = copyTarget.split(':');

        if (!srcVolume || !srcPath) {
            sendResponse({ complete: 1, code: 1, description: "Ungültiger Parameter: copy_source muss im Format Volume:mountPath sein." });
            return;
        }
        if (!tgtVolume || !tgtPath) {
            sendResponse({ complete: 1, code: 1, description: "Ungültiger Parameter: copy_target muss im Format Volume:mountPath sein." });
            return;
        }

        // Prüfen, ob der srcPath mit einem '*' endet und diesen entfernen
        let wildcard = false;
        srcPath = srcPath.trim();
        if (srcPath.endsWith('*')) {
            wildcard = true;
            srcPath = srcPath.slice(0, -1); // '*' entfernen
            // Falls ein zusätzlicher Slash am Ende ist, kannst du ihn belassen
        }

        print(`Starte Volume Copy: Quelle ${srcVolume}:${srcPath}${wildcard ? '*' : ''} -> Ziel ${tgtVolume}:${tgtPath}\n`);

        // Docker run-Befehl: Die Volumes werden an den angegebenen Mount-Punkten gemountet.
        // Anschließend wird sichergestellt, dass der Zielordner existiert und der Inhalt kopiert.
        const dockerCmd = `docker run --rm -v ${srcVolume}:${srcPath} -v ${tgtVolume}:${tgtPath} alpine sh -c "mkdir -p ${tgtPath} && cp -a ${srcPath}${wildcard ? '/*' : ''} ${tgtPath}"`;

        try {
            execSync(dockerCmd, { stdio: 'inherit' });
            print(`Volume Copy erfolgreich abgeschlossen.\n`);
            sendResponse({ complete: 1, code: 0, description: "Volume Copy erfolgreich abgeschlossen." });
        } catch (error) {
            print(`Fehler beim Volume Copy: ${error.message}\n`);
            sendResponse({ complete: 1, code: 1, description: `Fehler beim Volume Copy: ${error.message}` });
        }
        return; // Weitere Verarbeitung beenden, wenn Volume Copy ausgeführt wurde
    }
    // --- Ende des neuen Zweigs ---

    // Vorherige Logik für container_prefix und script

    const containerPrefix = params.container_prefix;
    const script = params.script;

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
            `docker ps --filter "name=${containerPrefix}" --format "{{.Names}}" | head -n 1`,
            { encoding: 'utf-8' }
        ).trim();

        if (container) {
            print(`Gefundener Container: ${container}\n`);

            // Standard-Temp-Verzeichnis im Container abrufen
            const tempDir = execSync(
                `docker exec "${container}" sh -c "echo \$TMPDIR || echo /tmp"`,
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
                execSync(`docker exec -i "${container}" sh -c "${escapedScript}"`, { stdio: 'inherit' });
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
