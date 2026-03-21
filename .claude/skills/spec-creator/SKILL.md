---
name: spec-creator
description: This skill should be used when the user asks to "create a spec", "create a task", "brainstorm an idea", "develop a specification", "design a feature", "refine this spec", "iterate on the design", "continue brainstorming", "revisit the approach", or wants to turn an idea into a fully-formed specification through collaborative dialogue.
---

# Spec Creator

Transform ideas into well-defined specifications through collaborative brainstorming dialogue. Focus on WHAT to build and WHY, not HOW to implement it.

## When This Skill Activates

**New spec creation:**
- User invokes `/create-spec "idea"` command
- User says "I have an idea for...", "let's brainstorm...", "I want to build..."

**Continuing/refining:**
- User says "refine this spec", "iterate on the design", "revisit the approach"
- User has a spec file open and wants to improve it
- User references a previous brainstorming session

## Core Principles

- **One question at a time** - Never overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
- **Project-aware** - Use knowledge of the codebase to inform questions and suggestions
- **Spec defines WHAT, not HOW** - Leave implementation details to the implementer

## The Process

### Phase 1: Gather Context (Silent)

Before asking any questions, silently gather project context:
1. Read key project files (README, CLAUDE.md, package.json, or equivalent)
2. Check recent git commits to understand current project momentum
3. Identify the tech stack, patterns, and conventions in use

Do NOT output this context research. Use it to inform questions.

**Skip this phase** when continuing/refining an existing spec - the context is already established.

### Phase 2: Understand the Idea

Start with a brief acknowledgment of the idea, then refine through questions.

**Question guidelines:**
- Ask ONE question at a time
- **Use the AskUserQuestion tool** for all questions - never ask questions as plain text
- Provide 2-4 concrete options based on project context (users can always select "Other")
- Include brief descriptions for each option explaining implications
- Use `multiSelect: true` when choices aren't mutually exclusive
- Focus on understanding: purpose, constraints, success criteria
- Use project knowledge to inform the options you present

**Key areas to explore (as relevant):**
- What problem does this solve? Who benefits?
- What does success look like?
- Are there existing patterns in the codebase to follow?
- What are the boundaries? What is explicitly NOT in scope?
- Are there constraints (performance, compatibility, dependencies)?

Aim for 3-7 questions total. Stop earlier if the idea is simple and well-defined.

**When refining an existing spec:** Focus questions on the specific areas that need improvement rather than re-exploring the entire idea.

### Phase 3: Explore Approaches

Once requirements are clear, propose 2-3 different implementation approaches.

**For each approach, cover:**
- A short descriptive name
- How it works (2-3 sentences)
- Trade-offs (pros and cons)
- When this approach is preferred

**Present the recommendation:**
- Lead with the recommended approach
- Explain why it's preferred given the constraints
- Use the AskUserQuestion tool to let the user select their preferred approach:
  - Put the recommended option first with "(Recommended)" in the label
  - Include a brief description of trade-offs for each option

Adapt if the user wants a different approach or a hybrid.

### Phase 4: Validate the Design

Once the approach is agreed upon, present the design focusing on user-facing behavior. After each section, use the AskUserQuestion tool to validate with a simple "Looks good, continue" option.

**Sections to cover (skip if not relevant):**
1. **User Stories** - Who does what and why
2. **Acceptance Criteria** - Testable conditions for "done"
3. **Edge Cases** - Error scenarios and expected behavior
4. **Constraints** - Security, performance, compatibility must-haves

**Capture specific values:** When requirements mention thresholds, limits, or validation rules, ensure they're actionable. Either specify the value explicitly, or note that it should match an existing system constraint. Vague requirements create ambiguity—make them concrete.

Keep each section focused. Be ready to go back and revise.

**Do NOT include:**
- File paths or function names
- Data flow diagrams
- Step-by-step implementation instructions
- Architecture details

These are for the implementer to figure out.

### Phase 5: Assess Complexity

Before presenting the final spec, assess if the task needs additional sections:

| Complexity | Indicators | Additional Sections |
|------------|------------|---------------------|
| Simple | Single feature, clear scope, few edge cases | None needed |
| Medium | Multiple components, some uncertainty | Key Decisions |
| Complex | Cross-cutting concerns, dependencies, risks | Phases, Dependencies, Risks |

For complex tasks, consider suggesting to break into multiple specs.

### Phase 6: Present the Complete Spec

Compile the full specification using the template below.

**Adapt the template:**
- Skip sections that aren't relevant
- Add optional sections based on complexity assessment
- Keep it focused - apply YAGNI ruthlessly

### Phase 7: Save the Spec

After presenting the complete spec, use the AskUserQuestion tool to ask where to save:
- Offer location options based on the project (e.g., `specs/`, `docs/`, project root)
- Include a "Don't save" option - the spec is already in the conversation
- Users can select "Other" to specify a custom location

Only save after the user confirms the location.

## Spec Template

```markdown
# [Task Title]

## Overview
[2-3 sentences: What is being built and why]

## User Stories
- As a [user], I can [action] so that [benefit]

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]

## Non-Goals
- [What this task explicitly does NOT include]

## Constraints
- [Security, performance, compatibility, patterns to follow]

## Key Decisions
[Capture WHAT was decided and WHY - not implementation details like file paths or function names]
- [Decision: which approach/library/pattern and why it was chosen]

## Edge Cases
| Scenario | Expected Behavior |
|----------|-------------------|
| [Error case] | [How it's handled] |

## Open Questions
- [Unresolved decisions or uncertainties]

## References
- [Links to relevant docs, existing patterns, prior art]
```

### Optional Sections (for complex tasks)

**Dependencies** - Include when the task depends on other work:
```markdown
## Dependencies
- [What must exist before this can be built]
- [Systems or services this integrates with]
```

**Phases** - Include when task should be broken into milestones:
```markdown
## Phases

### Phase 1: [Name]
**Goal:** [What this phase achieves]
- [ ] Acceptance criteria for phase 1

### Phase 2: [Name]
**Goal:** [What this phase achieves]
- [ ] Acceptance criteria for phase 2
```

**Risks & Unknowns** - Include when there's significant uncertainty:
```markdown
## Risks & Unknowns
| Risk | Impact | Mitigation |
|------|--------|------------|
| [What could go wrong] | [Consequence] | [How to address] |
```

## Handling Continuation

When the user wants to refine or iterate on an existing spec:

1. **Identify what exists** - Is there a spec file? Previous conversation context?
2. **Understand the goal** - What specifically needs refinement?
3. **Jump to the relevant phase** - Don't restart from scratch
4. **Preserve context** - Build on what's already been decided

Example flows:
- "The approach doesn't feel right" → Go back to Phase 3
- "We missed an edge case" → Add to edge cases, update acceptance criteria
- "Add a new requirement" → Return to Phase 2, then ripple through
- "This is too big" → Help break into phases or separate specs
