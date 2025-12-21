# Start of Selection

# Code Quality & Resilience Workplan

> [!IMPORTANT]
> This is a living document outlining a strategic roadmap for elevating the `Open-Q` codebase to enterprise-grade quality. It prioritizes structural robustness, testing confidence, and maintainability.

## 1. Executive Summary

The current `Open-Q` codebase functions correctly but exhibits signs of "rapid prototyping" debt: duplicate logic, fragile tests, and monolithic state management. To ensure long-term maintainability and reliability, we must shift from "making it work" to "making it robust."

**Key Objectives:**

1.  **Architecture:** Decouple Logic from UI.
2.  **State Management:** Split the monolithic `useStudyStore`.
3.  **Testing:** Establish a "Testing Pyramid" (Unit -> Integration -> E2E).
4.  **Hygiene:** Enforce strict typing and linting.

---

## 2. Strategic Phases

### Phase 1: Foundation & Hygiene (Immediate Impact)

_Goal: Stop the bleeding. Prevent new bad code from entering._

- [ ] **Strict Linting & Formatting**:
  - Add `prettier` and strict ESLint rules (e.g., `no-explicit-any`, `no-unused-vars`).
  - run `npm run lint:fix` globally.
- [ ] **Type Strengthening**:
  - Audit `tsconfig.json` for `strict: true`.
  - Replace all `any` usage with specific types or `unknown`.
  - Centralize shared types in `src/types/` (currently scattered).
- [ ] **Dead Code Removal**:
  - Systematically remove unused imports, components, and assets.
  - Remove legacy CSS/SCSS if Tailwind is the standard.

### Phase 2: Architectural Refactoring (Structure)

_Goal: Make the code easier to read and safer to change._

- [ ] **Split `useStudyStore`**:
  - The store is becoming a "God Object".
  - **Refactor**: Split into slices:
    - `useSessionStore`: Auth, Steps, Persistence.
    - `useResponseStore`: Sort data (Rough, Fine, Post).
    - `useUIStore`: Zoom, Modals, Tips (Ephemeral UI state).
- [ ] **Pattern Enforcement**:
  - **Container/Presenter Pattern**: Separate heavy logic (fetching, calculation) from rendering components.
  - **Custom Hooks**: Extract logic from large components (e.g., `GridSort.tsx` is >400 lines).
    - Extract `useGridCalculations` (geometry).
    - Extract `useDeckManagement` (pile handling).
- [ ] **Error Boundary Implementation**:
  - Wrap major features (Sort Pages) in granular Error Boundaries to prevent full app crashes.

### Phase 3: Testing Strategy (Confidence)

_Goal: Sleep better at night knowing the app works._

- [ ] **Integration Test Overhaul**:
  - Continue the work started on `FineSortPage.mobile.test.tsx`.
  - **Rule**: Test behavior, not implementation details.
  - Mock at the _Service_ layer (API), not the internal hook layer whenever possible, to unintentional coupling.
- [ ] **E2E Testing (Playwright)**:
  - Add meaningful E2E flows (Welcome -> Consent -> Rough -> Fine -> Submit).
  - This captures "happy paths" that unit tests miss.
- [ ] **Visual Regression Testing**:
  - Setup basic snapshot testing for critical UI components (Card, Slot, Header) to catch CSS regressions.

### Phase 4: Documentation & Developer Experience

_Goal: Make the project approachable for new contributors._

- [ ] **Storybook**:
  - Implement Storybook for `SortableCard`, `DroppableSlot`, and `Button` components.
  - Allows UI development in isolation.
- [ ] **Architecture Diagrams**:
  - Document the Data Flow (Backend -> Store -> UI) using Mermaid.
  - Document the Sorting Logic Flow (Drag & Drop mechanics).

---

## 3. Immediate Action Items (Next Steps)

1.  **Dependency Audit**: Check `package.json` for unused deps.
2.  **Linting Pass**: Run a strict lint check and fix low-hanging fruit.
3.  **Store Analysis**: Draft the `useStudyStore` slice/decomposition plan.

## 4. Risks & Mitigations

| Risk                           | Mitigation                                                                                      |
| :----------------------------- | :---------------------------------------------------------------------------------------------- |
| **Regression during Refactor** | Heavy reliance on the newly improved Integration Tests before merging refactors.                |
| **"Over-engineering"**         | Adhere to YAGNI (You Ain't Gonna Need It). Only extract hooks if logic is complex or reused.    |
| **Test Maintenance Burden**    | Focus on _Public Public_ (Component Props & User Events), avoid testing private internal state. |
