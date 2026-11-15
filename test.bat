@echo off
setlocal
pushd "%~dp0"
call "..\AppDock.at365\dev.bat" exec node --test "%~dp0tests\processing.test.cjs" "%~dp0tests\dictionary-store.test.cjs" "%~dp0tests\applet.test.cjs"
set "speech_result=%errorlevel%"
popd
exit /b %speech_result%
