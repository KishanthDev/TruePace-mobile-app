# TruePace — Product Vision & Core Philosophy

## 1. Executive Summary

TruePace is created for runners who demand **pure focus and uncompromising precision**. 

Modern running apps have evolved into social networks cluttered with newsfeeds, advertisements, heavy animations, live 3D satellite maps, and paywalled basic metrics. These bloated interfaces rapidly overheat mobile hardware, drain battery on endurance runs, and distract athletes from their flow state.

TruePace takes the opposite approach: **a radical commitment to performance, battery life, glanceability, and mathematical truth.**

---

## 2. Core Pillars

### 2.1 The Mathematical Truth of Movement
Commercial GPS apps often mask jitter and drift with aggressive, opaque smoothing or naive point-to-point addition, causing phantom mileage at stoplights and erratic pace swings. TruePace establishes truth through a deterministic, stateful multi-stage acceptance pipeline combining native GNSS Doppler velocity with Haversine distance and strictly bound stationary drift suppression.

### 2.2 Distraction-Free OLED HUD
During a run, the screen presents only what the runner needs to see:
- Elapsed Active Time
- Kilometers Traveled (Hero Tabular Metric)
- Instantaneous Doppler Pace
- Average Active Pace

Rendered in pitch black (`#000000`) for zero OLED pixel power consumption and stark contrast under blinding outdoor sunlight. No live maps. No social popups.

### 2.3 Intelligent, Non-Intrusive Guidance
Rather than bombarding runners with algorithmic noise, TruePace introduces intelligence in two carefully partitioned layers:
1. **Local Deterministic Analytics**: Instantaneous split comparisons, pace consistency indexes, rolling fatigue metrics, and personal records computed on-device in microseconds without battery drain.
2. **Asynchronous Contextual AI Coaching**: Post-run narrative insights, training adaptation recommendations, and personalized coaching that run asynchronously when the workout is finished, never competing for resources with real-time GPS tracking.

### 2.4 Respect for Athlete Privacy & Offline Sovereignty
The core engine runs 100% offline. Workouts belong to the runner and live in persistent local storage. Cloud sync and AI features are strictly opt-in, preserving privacy and ensuring full reliability on trail routes with zero cellular coverage.

---

## 3. Target Audience

1. **Serious & Pragmatic Runners**: Athletes training for 5K, 10K, half, and full marathons who want accurate pace data without wearing a bulky sports watch or draining their phone battery.
2. **Minimalist Fitness Enthusiasts**: Runners frustrated by paywalls, ads, and social media bloat in legacy running apps.
3. **Data-Conscious Athletes**: Users who care about pace consistency, split degradation, and genuine telemetry rather than gamified vanity metrics.

---

## 4. Product Boundaries & Non-Goals

- **No Live In-Run Map**: We will never render a live GPU map while a workout is actively tracking.
- **No In-App Social Feed**: TruePace is an athlete HUD and training tool, not a social network.
- **No Paywalled Basic Telemetry**: Distance, pace, splits, and local history remain open and accessible.
- **No AI Modification of Telemetry**: AI will never estimate, interpolate, or fabricate GPS distance or pace.
