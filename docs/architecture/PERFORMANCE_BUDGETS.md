# TruePace — Performance Budgets & Engineering Thresholds

To maintain TruePace's reputation as a high-performance, battery-friendly running tool, all changes must comply with these budgets.

---

## 1. Quantitative Budgets

| Metric | Target Budget | Hard Ceiling | Verification Method |
| :--- | :---: | :---: | :--- |
| **Foreground CPU Usage** | $< 2.5\%$ | $\le 5.0\%$ | Android Profiler / Xcode Instruments |
| **Background Battery Drain** | $< 3.0\% \text{ / hour}$ | $\le 4.5\% \text{ / hour}$ | Battery Historian / 60-min continuous GPS run |
| **Memory Footprint (RSS)** | $< 70\text{ MB}$ | $\le 95\text{ MB}$ | Memory profiler during 10K simulation |
| **Cold Startup to HUD Render** | $< 1.2\text{ s}$ | $\le 2.0\text{ s}$ | Screen trace / performance markers |
| **UI Telemetry Refresh Frame Rate** | $60\text{ fps}$ | $\ge 58\text{ fps}$ | React DevTools Profiler / Systrace |
| **Standalone Android APK Size** | $< 40\text{ MB}$ | $\le 50\text{ MB}$ | EAS build artifact output size |
| **Notification Live Update Throttle** | $1500\text{ ms}$ | $\ge 1000\text{ ms}$ | `LiveNotificationService.minUpdateIntervalMs` |

---

## 2. Inviolable Design Constraints

1. **Zero Map Rendering in Live HUD**: Live WebGL/OpenGL map components consume 15–25% CPU continuously and accelerate battery depletion. The active running HUD must remain completely map-free.
2. **Tabular Numerics**: Font rendering must use tabular figures (`tabular-nums`) to prevent horizontal layout reflows on high-frequency metric updates.
3. **Throttled Storage Writes**: Active run persistence writes are asynchronous and decoupled from the synchronous GPS coordinate reception pipeline.
4. **No Heavy Animation Libraries**: Rely exclusively on lightweight native transforms or NativeWind CSS classes. Avoid importing large physics or Lottie engines unless strictly justified.
