@echo off
cls
title Prototype CRM - Painel de Inicialização
color 0B

:MENU
cls
echo ==========================================================
echo           PROTOTYPE CRM - PAINEL DE INICIALIZAÇÃO
echo ==========================================================
echo.
echo   [1] Iniciar Ambiente de Demonstração (Seed + Abrir CRM)
echo   [2] Iniciar Sistema Limpo (Sem injetar novos dados)
echo   [3] Apenas Iniciar Servidores (Sem abrir o navegador)
echo   [4] Executar Apenas o Seed do Banco de Dados
echo   [5] Sair
echo.
echo ==========================================================
set /p opcao="Escolha uma opcao (1-5): "

if "%opcao%"=="1" goto OPCAO1
if "%opcao%"=="2" goto OPCAO2
if "%opcao%"=="3" goto OPCAO3
if "%opcao%"=="4" goto OPCAO4
if "%opcao%"=="5" goto EXIT
echo.
echo [ERRO] Opção inválida. Tente novamente.
timeout /t 2 >nul
goto MENU

:OPCAO1
echo.
echo ==========================================================
echo [1/3] Executando o Seed de Demonstração no Banco Local...
echo ==========================================================
cd /d "%~dp0backend"
call npx ts-node prisma/seed.ts
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao executar o Seed do Banco de Dados.
    echo Verifique os logs acima antes de prosseguir.
    pause
    goto MENU
)
echo.
echo ==========================================================
echo [2/3] Iniciando Servidor Backend em nova janela...
echo ==========================================================
start "Prototype CRM - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo.
echo ==========================================================
echo [3/3] Iniciando Interface Frontend em nova janela...
echo ==========================================================
start "Prototype CRM - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Aguardando inicialização rápida dos serviços...
timeout /t 4 /nobreak > nul
start http://localhost:5173
goto EXIT

:OPCAO2
echo.
echo ==========================================================
echo [1/2] Iniciando Servidor Backend em nova janela...
echo ==========================================================
start "Prototype CRM - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo.
echo ==========================================================
echo [2/2] Iniciando Interface Frontend em nova janela...
echo ==========================================================
start "Prototype CRM - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Aguardando inicialização rápida dos serviços...
timeout /t 4 /nobreak > nul
start http://localhost:5173
goto EXIT

:OPCAO3
echo.
echo ==========================================================
echo Iniciando os servidores em segundo plano...
echo ==========================================================
start "Prototype CRM - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "Prototype CRM - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
goto EXIT

:OPCAO4
echo.
echo ==========================================================
echo Executando Seed do Banco de Dados...
echo ==========================================================
cd /d "%~dp0backend"
call npx ts-node prisma/seed.ts
echo.
pause
goto MENU

:EXIT
echo.
echo Painel de inicialização encerrado.
timeout /t 2 > nul
exit
