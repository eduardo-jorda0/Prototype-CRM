#!/bin/bash
# Setup script para rodar backend com PostgreSQL remoto

set -e

echo "=== prototype CRM Backend - Setup com PostgreSQL Remoto ==="
echo ""

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "Por favor, copie .env.example para .env e configure o DATABASE_URL"
    exit 1
fi

# Verificar se DATABASE_URL está configurado
if grep -q "your-remote-db-host" ".env"; then
    echo "❌ DATABASE_URL ainda não foi configurado!"
    echo ""
    echo "Por favor, edite o arquivo .env e configure o DATABASE_URL com um dos serviços remoto:"
    echo "  1. Render: https://render.com"
    echo "  2. Railway: https://railway.app"
    echo "  3. Neon: https://neon.tech"
    echo "  4. AWS RDS: https://aws.amazon.com/rds"
    echo ""
    echo "Veja POSTGRESQL_SETUP.md para instruções detalhadas"
    exit 1
fi

echo "✅ DATABASE_URL configurado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Gerar Prisma Client
echo "🔧 Gerando Prisma Client..."
npm run prisma:generate

# Rodar migrations
echo "🗄️  Executando migrations..."
npx prisma migrate deploy

# Rodar testes
echo "🧪 Rodando testes de integração..."
npm test

echo ""
echo "✅ Setup concluído com sucesso!"
echo ""
echo "Para iniciar o servidor:"
echo "  npm run dev"
