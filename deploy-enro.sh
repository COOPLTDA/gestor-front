#!/bin/bash

echo "🚀 Deploy FRONTEND ENRO iniciado..."

REPO_DIR="/home/grupo/repo-frontend"   # <-- ajustar si difiere
DIST_DIR="$REPO_DIR/dist"
TARGET_DIR="/var/www/DistriGestionEnro"

echo "📥 Actualizando repo..."
cd $REPO_DIR || exit
git pull origin main

echo "📦 Instalando dependencias..."
npm install

echo "🔨 Compilando para ENRO..."
# Si tenés un .env.enro con las variables de ENRO, Vite lo toma con --mode enro
npm run build -- --mode enro

echo "🗑️ Limpiando destino anterior..."
rm -rf $TARGET_DIR/assets
rm -f  $TARGET_DIR/index.html

echo "🔄 Copiando dist a destino..."
rsync -av \
  $DIST_DIR/ \
  $TARGET_DIR/

echo "✅ Deploy FRONTEND ENRO finalizado"
