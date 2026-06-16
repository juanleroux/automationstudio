Copy `Siemens.Engineering.dll` here before building.

It ships with TIA Portal under, e.g.:

```
C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\Siemens.Engineering.dll
```

Use the path matching the TIA Portal version installed on this machine. The DLL
is GAC-registered by the TIA Portal installer, so it does not need to be shipped
with the build output (`<Private>false</Private>` in the .csproj) — it only needs
to be present here at compile time to resolve the reference.
