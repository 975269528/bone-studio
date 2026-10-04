@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
if not exist "node_modules\electron\package.json" goto missing_dependencies
if not exist "dist\index.html" goto missing_build
if not exist "dist-mcp\commands.cjs" goto missing_build
call npm.cmd start
if errorlevel 1 goto launch_failed
popd
exit /b 0

:missing_node
echo Node.js and npm are required. Install Node.js 22.12 or newer.
goto failed
:missing_dependencies
echo Dependencies are missing. Open a terminal here and run: npm install
goto failed
:missing_build
echo The app has not been built. Open a terminal here and run: npm run build
goto failed
:launch_failed
echo BoneStudio could not start. See the error above for details.
:failed
pause
popd
exit /b 1
