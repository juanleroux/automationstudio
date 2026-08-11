Copy all `Siemens.Engineering*.dll` files here before building.

They ship with TIA Portal under the PublicAPI folder for your installed version:

| TIA Version | DLL location |
|-------------|--------------|
| V18 | `C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\` |
| V19 | `C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\` |
| V20 | `C:\Program Files\Siemens\Automation\Portal V20\PublicAPI\V20\` |
| V21 | `C:\Program Files\Siemens\Automation\Portal V21\PublicAPI\V21\net48\` |

> **V21 note:** Starting with V21, Siemens moved the .NET Framework 4.8 assemblies into a
> `net48\` subfolder. Copy everything from that subfolder into this `lib\` directory.

### Quick copy (PowerShell — adjust version number as needed)

**V18 / V19 / V20:**
```powershell
Copy-Item "C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\*.dll" .\lib\
```

**V21+:**
```powershell
Copy-Item "C:\Program Files\Siemens\Automation\Portal V21\PublicAPI\V21\net48\*.dll" .\lib\
```

The DLLs are GAC-registered by the TIA Portal installer. The bridge is built with
`<Private>true</Private>` so the DLLs are also copied alongside the exe at build time,
which ensures they are found at runtime even if the GAC registration is not on that account.
