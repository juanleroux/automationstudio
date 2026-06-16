# SiemensTiaBridge

Self-hosted Windows bridge that exposes TIA Portal Openness over a local HTTP API,
so the Automation Studio server (Node, cross-platform) can drive a live TIA Portal
session without itself depending on .NET/Windows.

This is step 1 of TIA Portal integration: getting a reachable, working bridge process
that can open/close a TIA project via Openness. FB discovery and instance creation are
later steps that build on top of this.

## Prerequisites (Windows engineering workstation only)

- TIA Portal installed and licensed, **including the Openness option**.
- .NET Framework 4.8 Developer Pack (to build) / runtime (to run).
- The project must be opened with a TIA Portal version matching the Openness DLL
  referenced at build time (see below).

## Build

1. Copy `Siemens.Engineering.dll` from your TIA Portal install into `lib/`:
   ```
   C:\Program Files\Siemens\Automation\Portal V18\PublicAPI\V18\Siemens.Engineering.dll
   ```
   (adjust `V18` to your installed version)
2. From this folder:
   ```
   dotnet build -c Release
   ```
   (requires the .NET Framework 4.8 targeting pack; on a machine with only the
   .NET SDK installed, install it via the Visual Studio Installer → Individual
   Components → ".NET Framework 4.8 targeting pack")

## Run

```
SiemensTiaBridge.exe [port]
```

Default port is `5180`. The process must run under a Windows user account that has
rights to launch/automate TIA Portal (Openness inherits Windows auth from the
running process — no separate credentials are configured in the bridge itself).

## Test — step 1 checklist

1. **Listener smoke test** (no TIA Portal needed):
   ```
   curl http://localhost:5180/api/health
   ```
   Expect `{"status":"ok","projectOpen":false,"openProjectName":null}`. If this
   fails, the issue is the HTTP listener/port, not Openness.

2. **Open a known project**:
   ```
   curl -X POST http://localhost:5180/api/project/open \
     -H "Content-Type: application/json" \
     -d "{\"projectPath\":\"C:\\Projects\\MyPlant\\MyPlant.ap18\",\"withUi\":true}"
   ```
   Expect `{"success":true,"projectName":"MyPlant"}`. With `withUi: true`, TIA
   Portal's window should visibly open — confirms Openness is actually driving
   the application, not just returning a cached value.

3. **Re-check health** — `projectOpen` should now be `true` and `openProjectName`
   should match.

4. **Close**:
   ```
   curl -X POST http://localhost:5180/api/project/close
   ```
   Confirm TIA Portal's window closes (if `withUi` was true) and a subsequent
   `/api/health` call shows `projectOpen: false`.

5. **From the Automation Studio UI**: Settings → Siemens → set Bridge URL to
   `http://localhost:5180` (or wherever the bridge runs) → Test Connection.
   This calls the existing `web/server/routes/siemens.js` `/test` endpoint,
   which proxies to this bridge's `/api/health`.

## Known limitations at this step

- Single project/session at a time — no concurrency guard beyond "close whatever
  was open before opening the next one."
- No FB enumeration or instance creation yet (steps 2 and 4 of the integration plan).
- No auth between the Node server and the bridge — both are assumed to run on a
  trusted internal network. Do not expose this bridge's port outside that network.
