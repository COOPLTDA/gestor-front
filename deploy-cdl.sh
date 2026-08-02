#!/bin/bash

echo "🚀 Deploy FRONTEND CDL iniciado..."

REPO_DIR="/home/grupo/repo-frontend"   # <-- ajustar si difiere
DIST_DIR="$REPO_DIR/dist"
TARGET_DIR="/var/www/DistriGestion"

echo "📥 Actualizando repo..."
cd $REPO_DIR || exit
git pull origin main

echo "📦 Instalando dependencias..."
npm install

echo "🔨 Compilando para CDL..."
# Si tenés un .env.cdl con las variables de CDL, Vite lo toma con --mode cdl
# Asegurate de tener ese archivo en la raíz del repo o ajustá el modo
npm run build -- --mode cdl

echo "🗑️ Limpiando destino anterior..."
rm -rf $TARGET_DIR/assets
rm -f  $TARGET_DIR/index.html

echo "🔄 Copiando dist a destino..."
rsync -av \
  $DIST_DIR/ \
  $TARGET_DIR/

echo "✅ Deploy FRONTEND CDL finalizado"
