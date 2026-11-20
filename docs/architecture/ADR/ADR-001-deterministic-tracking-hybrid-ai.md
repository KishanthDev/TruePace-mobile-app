# ADR-001: Deterministic Tracking Engine & Hybrid AI Decoupling

## Context
Running applications frequently suffer from erratic pace spikes, GPS jitter, and battery exhaustion. Furthermore, introducing AI features into mobile apps often leads to unnecessary continuous background processing, heavy dependencies, and non-deterministic behavior.

## Decision
1. **Mathematical Determinism for Core Tracking**: Distance, instantaneous pace, active elapsed time, and per-kilometer splits must remain 100% deterministic, computed by pure TypeScript algorithms using the Haversine formula and GNSS Doppler velocity. AI models (LLMs or ML regressors) are strictly prohibited from modifying, filtering, or generating real-time tracking metrics.
2. **Asynchronous Post-Run AI**: AI coaching and training advice will be executed exclusively post-workout or on-demand.
3. **Zero Raw GPS Exfiltration**: The AI layer receives only aggregated metrics (splits, total time, pacing variance, distance), never raw geographic latitude/longitude coordinate traces.
4. **Offline Sovereignty**: If network access is lost or AI services are unavailable, the core app continues operating with full fidelity.

## Consequences
- **Positive**: Guaranteed battery efficiency; verifiable mathematical precision; 100% offline capability; complete user privacy protection.
- **Negative**: Real-time voice coaching cannot generate arbitrary dynamic LLM speech mid-run (pre-composed audio cues and structured templates are used instead).
