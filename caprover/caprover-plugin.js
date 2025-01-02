#!/usr/bin/env node

// CapRover Plugin for Cronicle
// Ermöglicht das Ausführen von Befehlen in Docker-Containern basierend auf einem Präfix
// Job-Parameter: container_prefix, script

const { execSync } = require('child_process');

// Setup stdin / stdout streams
process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

const JSONStream = require('pixl-json-stream');
const Tools = require('pixl-tools');

const stream = new JSONStream(process.stdin, process.stdout);

stream.on('json', function(job) {
    const params = job.params;
    const containerPrefix = params.container_prefix;
    const script = params.script;

    const print = (text) => {
        require('fs').appendFileSync(job.log_file, text);
    };

    if (!containerPrefix) {
        stream.write({ complete: 1, code: 1, description: "Fehlender Parameter: container_prefix" });
        return;
    }

    if (!script) {
        stream.write({ complete: 1, code: 1, description: "Fehlender Parameter: script" });
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
            // Befehl im Container ausführen
            execSync(`docker exec \"${container}\" ${script}`, { stdio: 'inherit' });
            stream.write({ complete: 1, code: 0, description: "Befehl erfolgreich ausgeführt." });
        } else {
            print(`Kein Container mit dem Präfix '${containerPrefix}' gefunden!\n`);
            stream.write({ complete: 1, code: 1, description: `Kein Container mit dem Präfix '${containerPrefix}' gefunden.` });
        }
    } catch (error) {
        print(`Fehler beim Ausführen des Befehls: ${error.message}\n`);
        stream.write({ complete: 1, code: 1, description: `Fehler: ${error.message}` });
    }
});
