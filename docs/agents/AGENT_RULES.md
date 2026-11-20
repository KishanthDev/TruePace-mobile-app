# TruePace — Autonomous Agent Operational Rules

## 1. Non-Negotiable Operational Rules

1. **Verify Before Action**: Never accept a claim without repository evidence. Inspect source code and configuration directly.
2. **Never Break Working Features**: Do not refactor or rewrite functional code without documented architectural necessity and prior test coverage.
3. **Deterministic Core GPS**: Never allow AI models, heuristic approximations, or cloud requests to determine or modify real-time GPS coordinate acceptance, distance, pace, or split calculations.
4. **Minimal Dependency Policy**: Never install a package if a clean, small TypeScript module or standard Expo/React Native API can accomplish the requirement.
5. **Quality Gates Mandatory**: Every task must pass TypeScript (`npx tsc --noEmit`), ESLint (`npx expo lint`), and relevant unit tests before being marked complete.
6. **No Silent Error Suppression**: Never suppress TypeScript errors, skip failing assertions, or comment out lint rules to force a pass.
7. **Preserve User Data**: Storage schema updates must include versioned keys, non-destructive migration strategies, and defensive fallbacks.
8. **Document Everything**: Maintain `CURRENT_STATE.md`, `ROADMAP.md`, `PROGRESS.md`, `BLOCKERS.md`, and `CHANGELOG.md` continuously.
