#!/bin/bash
set -e

echo "🚀 Deploy FRONTEND iniciado..."

REPO_DIR="/home/grupo/repo-frontend"
DIST_DIR="$REPO_DIR/dist"

echo "📥 Actualizando repo..."
cd $REPO_DIR || exit
git fetch origin
git reset --hard origin/main

echo "📦 Instalando dependencias..."
npm install

# ============================================================
# BUILD CDL
# ============================================================
echo ""
echo "🔨 Compilando CDL..."
npm run build -- --mode cdl.prod

echo "🗑️  Limpiando destino CDL..."
rm -rf /var/www/DistriGestion/assets
rm -f  /var/www/DistriGestion/index.html

echo "🔄 Copiando CDL → /var/www/DistriGestion..."
rsync -av $DIST_DIR/ /var/www/DistriGestion/

echo "✅ CDL listo"

# ============================================================
# BUILD ENRO
# ============================================================
echo ""
echo "🔨 Compilando ENRO..."
npm run build -- --mode enro.prod

echo "🗑️  Limpiando destino ENRO..."
rm -rf /var/www/DistriGestionEnro/assets
rm -f  /var/www/DistriGestionEnro/index.html

echo "🔄 Copiando ENRO → /var/www/DistriGestionEnro..."
rsync -av $DIST_DIR/ /var/www/DistriGestionEnro/

echo "✅ ENRO listo"

# ============================================================
echo ""
echo "🎉 Deploy FRONTEND finalizado"
