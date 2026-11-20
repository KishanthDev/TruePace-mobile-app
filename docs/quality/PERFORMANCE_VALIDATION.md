# TruePace — Performance Validation Protocol

## 1. Automated Baseline Measurements

Every milestone release must be measured against the established performance baselines:

```bash
# Static bundle and type checking speed
Measure-Command { npx tsc --noEmit }
Measure-Command { npx expo lint }

# Standalone APK artifact measurement (via GitHub Actions / EAS)
# Baseline threshold: < 45 MB APK size
```

---

## 2. Profiling Checkpoints

### 2.1 Battery Drain Profiling
- **Methodology**: 60-minute outdoor tracking session with screen set to 50% brightness or locked.
- **Pass Threshold**: Battery consumption must remain $< 3.5\%\text{ per hour}$.

### 2.2 Memory Stability (Leak Detection)
- **Methodology**: Run continuous GPS simulation for 2 hours (approx. 7,200 coordinate points).
- **Pass Threshold**: Memory allocation (RSS) must plateau $< 85\text{ MB}$ with no steady climb.

### 2.3 UI Render Performance
- **Methodology**: Measure React render times during high-frequency GPS coordinate emissions (1Hz).
- **Pass Threshold**: Component re-render latency for `RunHudScreen` and `MetricTile` must remain $< 8\text{ ms}$ (comfortably within the 16.6ms 60fps frame window).
