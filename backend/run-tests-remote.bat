@echo off
REM Script para rodar testes com PostgreSQL remoto
REM Uso: run-tests-remote.bat <DATABASE_URL>

setlocal enabledelayedexpansion

if "%1"=="" (
    echo.
    echo === prototype CRM - Rodar Testes com PostgreSQL Remoto ===
    echo.
    echo Uso: run-tests-remote.bat "your-database-url"
    echo.
    echo Exemplo com Neon:
    echo   run-tests-remote.bat "postgresql://user:pass@ep-project.neon.tech/prototype_crm?schema=public&sslmode=require"
    echo.
    echo Exemplo com Render:
    echo   run-tests-remote.bat "postgresql://user:pass@your-db.render.db:5432/prototype_crm?schema=public"
    echo.
    exit /b 1
)

echo ✅ Configurando banco remoto...
echo DATABASE_URL=%1 > .env.temp
echo JWT_SECRET=super-secret-jwt-key-prototype-crm-2026 >> .env.temp
echo UPLOAD_DIR=./uploads >> .env.temp

echo ✅ Instalando dependências...
call npm install

echo ✅ Gerando Prisma Client...
call npm run prisma:generate

echo ✅ Executando migrations...
call npx prisma migrate deploy

echo ✅ Rodando testes...
call npm test

if !ERRORLEVEL! EQU 0 (
    echo.
    echo ✅ Testes completados com sucesso!
) else (
    echo.
    echo ❌ Testes falharam. Verifique a DATABASE_URL
)

echo.
echo Limpando arquivo temporário...
del /f /q .env.temp 2>nul
