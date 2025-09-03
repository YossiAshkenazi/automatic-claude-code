@echo off
REM Add npm to PATH explicitly
set PATH=%PATH%;C:\Users\yossi\AppData\Roaming\npm

REM Test Claude is accessible
claude --version

REM Run the actual test
node dist/index.js run "create hello world" -i 1 -v