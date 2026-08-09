#!/bin/bash
set -e

# Deploy FARO (frontend) en PROD (192.168.11.104).
#
# Arquitectura real (confirmada en /etc/apache2/sites-available/farogestion-le-ssl.conf):
#   - DocumentRoot /var/www/farogestion/dist → Apache sirve el frontend
#     estático directo desde acá, con fallback SPA (index.html).
#   - ProxyPass /api → http://192.168.11.110:3001/api (backend faro-gestion).
# No hay que copiar nada a otro servidor: el build queda local y Apache ya
# apunta a esta carpeta.

echo "🚀 Deploy FARO (frontend) PROD iniciado..."

cd /var/www/farogestion || exit

echo "📥 Actualizando repo..."
git fetch origin
git reset --hard origin/main

echo "📦 Instalando dependencias..."
npm install

echo "🔨 Compilando FARO..."
npm run build -- --mode faro.prod

echo "✅ Deploy FARO (frontend) PROD finalizado"
