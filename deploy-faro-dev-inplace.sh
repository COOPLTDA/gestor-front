#!/bin/bash
set -e

# Deploy FARO (frontend) en DEV (192.168.11.100).
#
# Arquitectura real (confirmada en /etc/apache2/sites-available/farogestion-dev.conf):
#   - DocumentRoot /var/www/farogestion/dist → Apache sirve el frontend
#     estático directo desde acá, con fallback SPA (index.html).
#   - ProxyPass /api → http://localhost:3001/api (backend faro-gestion-dev,
#     mismo servidor).
# Deploy in-place: no hay que copiar nada a otro servidor.

echo "🚀 Deploy FARO (frontend) DEV iniciado..."

cd /var/www/farogestion || exit

echo "📥 Actualizando repo branch dev..."
git fetch origin
git reset --hard origin/dev

echo "📦 Instalando dependencias..."
npm install

echo "🔨 Compilando FARO DEV..."
npm run build -- --mode faro.dev

echo "✅ Deploy FARO (frontend) DEV finalizado"
