# TruePace — Claude & Agent Instructions

This document provides project-level instructions, architectural invariants, quality gates, and operational commands for TruePace.

---

## 1. Project Overview & Philosophy

TruePace is an OLED-optimized, battery-first, precision GPS running telemetry HUD built with **Expo SDK 57**, **React Native 0.86**, **React 19**, and **NativeWind / Tailwind CSS**.

- **App Name**: TruePace
- **Design Philosophy**: Minimalist, distraction-free running HUD. Zero live map rendering during runs to maximize battery life, frame stability, and glanceability in sunlight. Pitch black (`#000000`) OLED palette with high-contrast tabular typography.
- **Core Technology**: Offline-first, deterministic GPS tracking engine with hybrid on-device / optional serverless AI intelligence.

---

## 2. Inviolable Engineering Rules

1. **Deterministic Tracking Engine**:
   - Never allow AI, heuristics, or external network calls to modify or determine GPS coordinate acceptance, distance, pace, splits, active duration, or pause/resume states.
   - GPS calculations remain strictly mathematical (Haversine $R=6,371,000\text{ m}$, Doppler velocity, and strict stateful filtering).
2. **Minimal Dependencies**:
   - Never install third-party packages without prior architectural evaluation.
   - Prefer native Expo/React Native capabilities and small, pure TypeScript utilities.
3. **Battery-First & Offline-First**:
   - Zero continuous background AI execution.
   - Core tracking and run logging must function 100% offline without network access.
4. **Data Integrity & Backward Compatibility**:
   - Never delete or corrupt existing run history. Any AsyncStorage schema updates must be versioned, validated, and backward-compatible.
5. **Quality Gates**:
   - Always run `npx tsc --noEmit` and `npx expo lint` before declaring any task done.
   - No broken builds, no untyped `any` leaks in core tracking.

---

## 3. Essential Commands

```bash
# Package Installation (Always use expo install for SDK 57 compatibility)
npx expo install <package>

# Development Server
npx expo start
npx expo start --tunnel

# Static Validation
npx tsc --noEmit    # TypeScript typecheck
npx expo lint       # ESLint validation
npx expo-doctor     # Expo dependency and configuration check

# EAS Build (Android APK)
eas build --platform android --profile preview
```

---

## 4. Documentation Index

- Architecture: [`docs/architecture/`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/architecture/)
- Current State & Audit: [`docs/CURRENT_STATE.md`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/CURRENT_STATE.md)
- Product Roadmap: [`docs/ROADMAP.md`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/ROADMAP.md)
- Feature Specifications: [`docs/specifications/`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/specifications/)
- Quality & Test Strategy: [`docs/quality/`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/quality/)
- Autonomous Agent Protocols: [`docs/agents/`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/agents/)
- Progress & Decisions: [`docs/progress/`](file:///c:/KISHAN/SOURCECODE/AI/Run/docs/progress/)
