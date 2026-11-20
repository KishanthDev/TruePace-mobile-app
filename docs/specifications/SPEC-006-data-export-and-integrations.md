# SPEC-006: Data Portability (GPX/TCX Export, Strava, Health Connect)

1. **Specification ID**: SPEC-006
2. **Feature Name**: Data Portability (GPX/TCX Export, Strava, Health Connect)
3. **Status**: PROPOSED
4. **Problem Statement**: Athletes do not want to be locked into a proprietary running app. They need to export their data to standard fitness formats (GPX/TCX) and sync with third-party platforms like Strava or native health databases.
5. **User Value**: Runners own their data unconditionally and can export workouts to Garmin, Strava, or Apple Health/Google Health Connect.
6. **Goals**:
   - Generate standard XML-compliant GPX and TCX files with timestamps, speeds, and splits.
   - Use native share sheet (`expo-sharing` / `expo-file-system`) to export files.
   - Support optional OAuth sync to Strava and Android Health Connect.
7. **Non-Goals**:
   - No automatic cloud backup without explicit user consent.
8. **Functional Requirements**:
   - **FR-01**: Generate GPX 1.1 compliant XML file from stored workout coordinates.
   - **FR-02**: Generate TCX (Training Center XML) with active splits and heart rate/cadence placeholders.
   - **FR-03**: Trigger native OS share sheet for one-tap export.
9. **Non-Functional Requirements**:
   - File generation must take $< 1.0\text{ second}$ for a standard marathon workout ($> 30,000$ points).
10. **User Flows**:
    - Athlete opens past run -> Taps "Export" -> Selects "Export GPX" -> Native share sheet opens -> Athlete saves to Google Drive or sends to Strava.
11. **UI/UX Requirements**:
    - Minimalist modal with clean export buttons.
12. **Technical Architecture**:
    - Pure TypeScript XML serializer `src/utils/gpxSerializer.ts`.
    - `expo-file-system` and `expo-sharing`.
13. **Data Model Changes**:
    - Ensure coordinate breadcrumbs are optionally retained for export.
14. **API Requirements**: None for GPX/TCX; Strava API v3 for direct sync.
15. **Offline Behavior**: GPX/TCX generation and local file saving work 100% offline.
16. **Battery Impact**: Zero impact during running.
17. **Application Size Impact**: Minimal ($< 30\text{ KB}$ for serializer; standard Expo modules for sharing).
18. **Security and Privacy Considerations**: Anonymize starting/ending 200m if privacy zone feature is enabled.
19. **Dependency Analysis**: `expo-file-system`, `expo-sharing`.
20. **Testing Requirements**: XML validation against official GPX 1.1 XSD schema; Strava import compatibility testing.
21. **Acceptance Criteria**: Exported GPX files import cleanly into Strava, Garmin Connect, and Runkeeper.
22. **Failure Scenarios**: Empty coordinates list exports summary-only TCX activity.
23. **Backward Compatibility**: Fully backward compatible.
24. **Rollback Strategy**: Revert commits.
25. **Dependencies on Other Specifications**: Depends on SPEC-004.
26. **Implementation Phases**:
    - Phase 4.3: GPX serializer & sharing flow.
    - Phase 4.4: Third-party sync connectors.
27. **Definition of Done**: Schema-valid GPX output and successful real-world import.
