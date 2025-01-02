#!/bin/sh

# Pfad zur storage-cli.js
STORAGE_CLI="/opt/cronicle/bin/storage-cli.js"

# Pfad zur Plugin-JSON-Datei
PLUGIN_JSON_FILE="/opt/cronicle/caprover/caprover-plugin.json"

# Überprüfen, ob die JSON-Datei existiert
if [ ! -f "$PLUGIN_JSON_FILE" ]; then
  echo "Fehler: Plugin-JSON-Datei ($PLUGIN_JSON_FILE) nicht gefunden!"
  exit 1
fi

# Plugin in global/plugins speichern
cat "$PLUGIN_JSON_FILE" | node $STORAGE_CLI put global/plugins/caprover-plugin

# Aktuelle Plugin-Liste abrufen
node $STORAGE_CLI get global/plugins/0 > /tmp/plugins.json

# Neues Plugin zur Liste hinzufügen
UPDATED_PLUGIN_LIST=$(jq ".items += [$(cat "$PLUGIN_JSON_FILE")]" /tmp/plugins.json)

# Überprüfung: Fehlerbehebung für leere oder fehlerhafte Liste
if [ -z "$UPDATED_PLUGIN_LIST" ]; then
  echo "Fehler beim Verarbeiten der Plugin-Liste!"
  exit 1
fi

# Aktualisierte Plugin-Liste speichern
echo "$UPDATED_PLUGIN_LIST" | node $STORAGE_CLI put global/plugins/0

# Überprüfung der Plugins-Liste
echo "Verfügbare Plugins nach dem Hinzufügen:"
node $STORAGE_CLI get global/plugins/0
