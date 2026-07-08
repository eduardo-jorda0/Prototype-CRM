# Deployment do prototype CRM Backend - Sem Localhost

## Opção 1: Deploy Completo em Render

Render oferece PostgreSQL gerenciado + Node.js hosting, tudo na nuvem, zero localhost.

### Passo 1: Criar o Banco PostgreSQL no Render

1. Acesse https://render.com e faça login
2. Clique em "New +" e selecione "PostgreSQL"
3. Configure:
   - **Name:** `prototype-crm-db`
   - **Database:** `prototype_crm`
   - **User:** `postgres`
   - **Region:** Escolha o mais próximo
   - **Plan:** Free (0.5GB storage)
4. Clique em "Create Database"
5. Copie a "External Database URL"

### Passo 2: Deploy do Backend no Render

1. Faça push do código para GitHub (fork ou crie repo)
2. No Render, clique em "New +" > "Web Service"
3. Selecione o repositório
4. Configure:
   - **Name:** `prototype-crm-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build && npx prisma migrate deploy`
   - **Start Command:** `npm start`
   - **Plan:** Free (0.5GB RAM)
5. Em "Environment," adicione:
   ```
   DATABASE_URL=postgresql://...  # URL copiada no Passo 1
   JWT_SECRET=super-secret-jwt-key-prototype-crm-2026
   UPLOAD_DIR=./uploads
   NODE_ENV=production
   PORT=5000
   ```
6. Clique em "Create Web Service"

O backend estará disponível em: `https://prototype-crm-backend.onrender.com`

---

## Opção 2: Deploy em Railway

Railway oferece um painel integrado para banco + aplicação.

### Passo 1: Criar Projeto e Banco

1. Acesse https://railway.app
2. Crie uma nova conta
3. Crie um novo projeto
4. Adicione "PostgreSQL" ao projeto
5. Configure as variáveis de ambiente geradas

### Passo 2: Deploy da Aplicação

1. Conecte seu repositório GitHub
2. Railway auto-detecta o Node.js
3. Configure o build:
   ```
   npm install && npm run build && npx prisma migrate deploy
   ```
4. Configure o start:
   ```
   npm start
   ```

Railway cria automaticamente um URL público para sua aplicação.

---

## Opção 3: Deploy em Heroku (com Free Tier Limitado)

1. Crie uma conta em https://www.heroku.com
2. Crie uma nova app
3. Adicione um PostgreSQL add-on
4. Conecte seu repositório GitHub
5. Configure variáveis de ambiente
6. Deploy automático ao fazer push

---

## Opção 4: Deploy em AWS (mais complexo)

1. Create an RDS PostgreSQL instance
2. Deploy backend em EC2 ou Lambda
3. Configure o DATABASE_URL para apontar ao RDS

---

## Testes Após Deploy

Uma vez que o backend esteja rodando remotamente:

```bash
# Criar arquivo .env com a URL remota
echo 'DATABASE_URL=<URL_DO_SEU_BANCO_REMOTO>' > .env
echo 'JWT_SECRET=super-secret-jwt-key-prototype-crm-2026' >> .env

# Rodar testes
npm test
```

---

## Importante

✅ **Vantagens do Deploy Remoto:**
- Sem dependência de localhost
- Banco e aplicação em ambientes isolados e seguros
- Escalabilidade fácil
- HTTPS automático
- Backups automáticos

❌ **Evite:**
- Nunca use DATABASE_URL apontando para localhost
- Nunca comita .env com credenciais
- Sempre use variáveis de ambiente

---

## Verificar Status

Após deployar, verifique se está funcionando:

```bash
curl https://seu-backend-url/health
# Resposta esperada: {"status":"ok"}

curl https://seu-backend-url/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```
