#!/bin/bash

# Überprüfen, ob das Skript mit sudo-Rechten ausgeführt wird
if [[ $EUID -ne 0 ]]; then
   echo "Dieses Skript muss mit sudo-Rechten ausgeführt werden." >&2
   exit 1
fi

# Version als Variable
VERSION="v1.11.3"

# Image-Name
IMAGE_NAME="casparjones/cronicle-edge"

# Build und Push
docker build -t $IMAGE_NAME:$VERSION .
docker tag $IMAGE_NAME:$VERSION $IMAGE_NAME:latest
docker push $IMAGE_NAME:$VERSION
docker push $IMAGE_NAME:latest

echo "Build und Push erfolgreich abgeschlossen."
