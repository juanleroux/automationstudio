Copy all Siemens Openness DLL files here before building.

The source location changed in V21:

| TIA Version | Copy DLLs from |
|-------------|----------------|
| V18 | `C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\` |
| V19 | `C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\` |
| V20 | `C:\Program Files\Siemens\Automation\Portal V20\PublicAPI\V20\` |
| V21+ | `C:\Program Files\Siemens\Automation\Portal V21\Bin\PublicAPI\` |

> **V21+ note:** Siemens no longer distributes `Siemens.Engineering.dll` as a single
> assembly. The API is split across several DLLs (`Siemens.Engineering.Base.dll`,
> `Siemens.Engineering.Step7.dll`, etc.) found in `Bin\PublicAPI\`. Copy everything
> from that folder. The DLLs are also **not** GAC-registered in V21, so `Private=true`
> in the .csproj ensures they are bundled alongside the exe at build time.

### Quick copy (PowerShell — run as Administrator, adjust version)

**V18 / V19 / V20:**
```powershell
Copy-Item "C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\*.dll" .\lib\
```

**V21+:**
```powershell
Copy-Item "C:\Program Files\Siemens\Automation\Portal V21\Bin\PublicAPI\*.dll" .\lib\
```

Then rebuild:
```powershell
dotnet build -c Release
.\bin\Release\net48\SiemensTiaBridge.exe 5180
```
