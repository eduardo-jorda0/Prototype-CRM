# PostgreSQL Remote Setup

## Opção 1: Usar Render (Recomendado - Gratuito)

1. Acesse https://render.com
2. Crie uma conta
3. Crie um novo "PostgreSQL"
4. Configure:
   - Name: `prototype-crm-db`
   - Database: `prototype_crm`
   - User: `postgres`
   - Region: Escolha mais próximo
5. Copie a "External Database URL"
6. Adicione ao `.env`:
   ```
   DATABASE_URL="<URL da Render>"
   ```
7. Rode `npx prisma migrate deploy`

## Opção 2: Usar Railway

1. Acesse https://railway.app
2. Crie uma conta
3. Crie um novo projeto
4. Adicione um "PostgreSQL"
5. Copie a connection string
6. Adicione ao `.env`
7. Rode `npx prisma migrate deploy`

## Opção 3: Usar Neon (PostgreSQL Serverless)

1. Acesse https://neon.tech
2. Crie uma conta
3. Crie um projeto PostgreSQL
4. Copie a connection string com `?sslmode=require`
5. Adicione ao `.env`
6. Rode `npx prisma migrate deploy`

## Opção 4: AWS RDS

1. Acesse AWS Console
2. Crie um RDS PostgreSQL instance
3. Copie o endpoint
4. Formato: `postgresql://admin:password@your-instance.amazonaws.com:5432/prototype_crm?schema=public`
5. Adicione ao `.env`
6. Rode `npx prisma migrate deploy`

## Próximos Passos

Após configurar o DATABASE_URL com um banco remoto:

```bash
# Instalar dependências
npm install

# Executar migrations
npx prisma migrate deploy

# Rodar os testes
npm test

# Iniciar o servidor
npm run dev
```

## Importante

- **Nunca use localhost** para o DATABASE_URL em produção
- Sempre use um banco remoto seguro
- Proteja as credenciais do banco em variáveis de ambiente
- Use `?sslmode=require` para conexões seguras (especialmente Neon)
