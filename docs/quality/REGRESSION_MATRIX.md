# TruePace — Regression Matrix

This matrix documents the critical test cases that must be verified before releasing any modification to the TruePace platform.

| ID | Test Scenario | Expected Outcome | Verification Tier |
| :--- | :--- | :--- | :---: |
| **REG-01** | **Stationary Indoors** (Phone still on desk for 15 mins) | Distance remains exactly $0.00\text{ KM}$; pace displays `--'--"`. | Unit / Field |
| **REG-02** | **Stoplight Pause** (Runner halts at intersection for 90s) | Instantaneous pace drops to `--'--"`; distance halts; active time pauses if runner presses PAUSE. | Unit / Field |
| **REG-03** | **Manual Pause & Resume** | Anchor is cleared on pause; resumed anchor establishes fresh on next valid point; zero distance accumulated during pause. | Unit / Integration |
| **REG-04** | **Restored Paused Session** | App killed while paused; restarted $< 12\text{h}$; resumes successfully with active GPS tracking streams. | Integration |
| **REG-05** | **Signal Dropout (Tunnel / Underpass)** | GPS lost for $> 15\text{s}$; when signal returns, new anchor establishes without adding straight-line gap distance. | Unit / Integration |
| **REG-06** | **Teleportation / Jitter Spike** | Inaccurate reading with implied speed $> 8.0\text{ m/s}$ ($28.8\text{ km/h}$) is rejected with `IMPOSSIBLE_SPEED`. | Unit |
| **REG-07** | **Sub-2m Micro Movements** | Coordinates shifting $< 2.0\text{m}$ do not move anchor; genuine cumulative motion builds up until threshold crossed. | Unit |
| **REG-08** | **Screen Lock & Background Service** | Screen locked during active run; foreground service notification updates distance and active time; GPS continues recording. | Physical Device |
| **REG-09** | **Per-KM Split & Audio Cue** | At exact $1000\text{m}$ intervals, split duration is recorded; audio cue announces split time and avg pace; fastest split tagged. | Unit / Field |
| **REG-10** | **Accidental Tap Protection** | Tapping FINISH or CLEAR HISTORY requires explicit confirmation modal. | UI / E2E |
| **REG-11** | **History Persistence & Isolation** | Deleting run ID `X` removes only `X` from `@truepace_run_history_v1`; all other past runs remain untouched. | Unit / Storage |
| **REG-12** | **Offline Cold Launch** | App launches with zero Wi-Fi or cellular; GPS gatekeeper acquires satellite lock; workout starts, tracks, and saves offline. | Device Offline |
