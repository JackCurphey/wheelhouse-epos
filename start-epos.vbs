Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Locate docker.exe directly rather than relying on PATH, which may not be
' refreshed yet for processes descending from an Explorer session that
' predates the Docker Desktop install - same reasoning as the node.exe
' lookup this script used to do for the pre-Docker version.
dockerExe = "docker"
knownPaths = Array("C:\Program Files\Docker\Docker\resources\bin\docker.exe")
For Each p In knownPaths
    If fso.FileExists(p) Then
        dockerExe = p
        Exit For
    End If
Next

' "docker compose up -d --wait" blocks until the app container's healthcheck
' passes (or fails/times out), so there's no need to guess a sleep duration
' the way the old plain-node version did - the browser only opens once the
' stack is actually confirmed up. Runs in a visible window so startup
' problems (Docker Desktop not running, build errors, etc.) are visible
' rather than silently swallowed.
cmdLine = "cmd /c title Wheelhouse EPOS (Docker) && """ & dockerExe & """ compose up -d --wait || pause"

WshShell.Run cmdLine, 1, True

WshShell.Run "http://localhost:4000", 1, False
