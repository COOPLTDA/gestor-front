#!/bin/bash
set -e
echo "🚀 Deploy FRONTEND DEV iniciado..."

REPO_DIR="/home/grupo/repo-frontend"
DIST_DIR="$REPO_DIR/dist"

echo "📥 Actualizando repo branch dev..."
cd $REPO_DIR || exit
git fetch origin
git reset --hard origin/dev

echo "📦 Instalando dependencias..."
/usr/bin/npm install

# BUILD CDL
echo "🔨 Compilando CDL DEV..."
/usr/bin/npm run build -- --mode cdl.dev

echo "🔄 Copiando CDL → /var/www/distrigestion-cdl..."
rsync -av $DIST_DIR/ /var/www/distrigestion-cdl/

# BUILD ENRO
echo "🔨 Compilando ENRO DEV..."
/usr/bin/npm run build -- --mode enro.dev

echo "🔄 Copiando ENRO → /var/www/distrigestion-enro..."
rsync -av $DIST_DIR/ /var/www/distrigestion-enro/

# BUILD FARO
echo "🔨 Compilando FARO DEV..."
/usr/bin/npm run build -- --mode faro.dev

echo "🔄 Copiando FARO → /var/www/faro-gestion-dev..."
rsync -av $DIST_DIR/ /var/www/faro-gestion-dev/

echo "✅ Deploy FRONTEND DEV finalizado"
