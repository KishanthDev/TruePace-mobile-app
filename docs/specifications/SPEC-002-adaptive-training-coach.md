# SPEC-002: Adaptive Post-Run AI Coaching & Recovery Insights

1. **Specification ID**: SPEC-002
2. **Feature Name**: Adaptive Post-Run AI Coaching & Recovery Insights
3. **Status**: PROPOSED
4. **Problem Statement**: Runners often finish a workout without understanding what their pacing data implies regarding aerobic threshold, fatigue onset, or required recovery time before their next session.
5. **User Value**: Runners receive clear, conversational, non-judgmental guidance explaining pacing mechanics, identifying the exact kilometer where fatigue set in, and recommending recovery windows.
6. **Goals**:
   - Provide an optional, on-demand AI analysis button on the Run Summary screen.
   - Generate structured insights conforming to a strict JSON schema.
   - Anonymize all request payloads by excluding raw GPS coordinates.
   - Allow user-supplied API keys (BYOK) with encrypted local storage.
7. **Non-Goals**:
   - No real-time AI during active runs.
   - No medical or orthopedic diagnostic claims.
8. **Functional Requirements**:
   - **FR-01**: Sanitize run summary into an aggregated statistical payload.
   - **FR-02**: Call secure edge proxy or user BYOK endpoint with structured prompt.
   - **FR-03**: Validate received payload against `AiRunCoachingReport` schema.
   - **FR-04**: Display coaching card on summary screen with expandable details.
9. **Non-Functional Requirements**:
   - Response time $< 5.0\text{ seconds}$ on standard LTE/5G.
   - Graceful timeout handling ($8\text{ seconds}$ abort).
10. **User Flows**:
    - Runner completes workout -> Taps "Generate AI Coach Insights" -> Spinner appears -> Structured advice card renders: "You maintained consistent pacing until KM 4 where pace degraded by 18%. Suggest 24h recovery before next tempo session."
11. **UI/UX Requirements**:
    - Emerald accent borders, collapsible cards, OLED black background.
12. **Technical Architecture**:
    - Client AI service `src/services/AiCoachingService.ts`.
    - Native `fetch` with AbortController.
13. **Data Model Changes**:
    - Add `aiReport?: AiRunCoachingReport` to `RunSummary`.
14. **API Requirements**: OpenAI / Gemini compatible completion endpoint returning strict JSON mode.
15. **Offline Behavior**: Button shows "Offline — AI Coaching requires network" and gracefully disables without error.
16. **Battery Impact**: Zero impact during run; minimal single network request post-run.
17. **Application Size Impact**: $< 20\text{ KB}$ (zero external AI SDKs; standard `fetch`).
18. **Security and Privacy Considerations**:
    - Zero geographic coordinates transmitted.
    - BYOK keys stored in secure storage.
19. **Dependency Analysis**: Zero new packages.
20. **Testing Requirements**:
    - Unit tests with mock responses and schema validation.
    - Timeout and offline error handling tests.
21. **Acceptance Criteria**:
    - Schema validation strictly rejects malformed LLM responses.
    - Core run summary persists even if AI request fails.
22. **Failure Scenarios**: Network failure or invalid API key displays user-friendly retry message.
23. **Backward Compatibility**: Fully backward compatible; `aiReport` is an optional property.
24. **Rollback Strategy**: Disable AI button in UI.
25. **Dependencies on Other Specifications**: Depends on SPEC-001 (Analytics foundation).
26. **Implementation Phases**:
    - Phase 3.1: Service and prompt design.
    - Phase 3.2: Edge proxy / BYOK configuration.
    - Phase 3.3: UI presentation on summary screen.
27. **Definition of Done**: Passing tests, validated privacy sanitization, clean offline fallback.
