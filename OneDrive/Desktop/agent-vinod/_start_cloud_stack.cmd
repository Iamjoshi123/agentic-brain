@echo off
cd /d "c:\Users\Lenovo\OneDrive\Desktop\agent-vinod"
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if not "%%A"=="" if not "%%A:~0,1"=="#" set "%%A=%%B"
)
call scripts\start-cloud-stagehand.cmd
