#!/bin/bash
set -e

echo "=== DEPLOY FRONTEND ==="

cd "$(dirname "$0")" || exit

# Rama actual

CURRENT_BRANCH=$(git branch --show-current)
echo "Rama actual: $CURRENT_BRANCH"

# Nos aseguramos de estar en dev

git checkout dev || exit

# Agregar cambios

git add .

# Commit

read -p "Mensaje de commit: " msg
git commit -m "$msg"

# Push a dev

git push origin dev

# Merge a main

git checkout main || exit
git pull origin main
git merge dev

# Push a main

git push origin main

# Volver a dev

git checkout dev

echo "=== DEPLOY FRONTEND COMPLETADO ==="
