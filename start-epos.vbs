Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Locate node.exe directly rather than relying on PATH, which may not be
' refreshed for new processes right after installing Node.js.
nodeExe = "node"
knownPaths = Array("C:\Program Files\nodejs\node.exe", "C:\Program Files (x86)\nodejs\node.exe")
For Each p In knownPaths
    If fso.FileExists(p) Then
        nodeExe = p
        Exit For
    End If
Next

cmdLine = "cmd /c title Wheelhouse EPOS Server && """ & nodeExe & """ server\server.js"

' Start the server in a visible window (so it can be closed to stop the app)
WshShell.Run cmdLine, 1, False

' Give the server a moment to start, then open the browser
WScript.Sleep 1500
WshShell.Run "http://localhost:4000", 1, False
