---
name: superpowers
description: Superpowers software development methodology and agentic skills framework. Use to guide disciplined engineering practices including brainstorming, writing plans, test-driven development (TDD), systematic debugging, subagent-driven development, and code review.
---

# Superpowers: Agentic Software Development Methodology

Superpowers transforms AI coding agents into disciplined senior engineers following proven engineering practices.

## Core Rule

**Invoke relevant or requested skills BEFORE taking action** — including asking clarifying questions, exploring the codebase, or modifying files.

- When building new features or changing requirements: invoke [`brainstorming`](../brainstorming/SKILL.md) first.
- When planning multi-step work: invoke [`writing-plans`](../writing-plans/SKILL.md) and [`executing-plans`](../executing-plans/SKILL.md).
- When writing new code or features: invoke [`test-driven-development`](../test-driven-development/SKILL.md).
- When encountering errors or bugs: invoke [`systematic-debugging`](../systematic-debugging/SKILL.md) before attempting fixes.
- When executing tasks via subagents: invoke [`subagent-driven-development`](../subagent-driven-development/SKILL.md).
- Before claiming completion: invoke [`verification-before-completion`](../verification-before-completion/SKILL.md).

## Available Skills in this Project

| Skill | Purpose | Link |
| :--- | :--- | :--- |
| **`using-superpowers`** | Meta-skill establishing the invocation rules and mindset | [SKILL.md](../using-superpowers/SKILL.md) |
| **`brainstorming`** | Refines ideas into detailed specs before writing code | [SKILL.md](../brainstorming/SKILL.md) |
| **`writing-plans`** | Breaks down specs into bite-sized, verifiable tasks | [SKILL.md](../writing-plans/SKILL.md) |
| **`executing-plans`** | Coordinates the structured execution of an approved plan | [SKILL.md](../executing-plans/SKILL.md) |
| **`test-driven-development`** | Enforces strict Red-Green-Refactor cycles | [SKILL.md](../test-driven-development/SKILL.md) |
| **`systematic-debugging`** | Multi-phase root-cause analysis (no guess-and-check) | [SKILL.md](../systematic-debugging/SKILL.md) |
| **`subagent-driven-development`** | Dispatches independent subagents per task to preserve context | [SKILL.md](../subagent-driven-development/SKILL.md) |
| **`requesting-code-review`** | Prepares thorough reviews for peer feedback | [SKILL.md](../requesting-code-review/SKILL.md) |
| **`receiving-code-review`** | Evaluates and applies review feedback systematically | [SKILL.md](../receiving-code-review/SKILL.md) |
| **`verification-before-completion`** | Confirms all requirements and tests pass before finishing | [SKILL.md](../verification-before-completion/SKILL.md) |
| **`finishing-a-development-branch`** | Cleanly closes branches, merges, and cleans up | [SKILL.md](../finishing-a-development-branch/SKILL.md) |
| **`using-git-worktrees`** | Manages isolated branches without touching current workspace | [SKILL.md](../using-git-worktrees/SKILL.md) |
| **`dispatching-parallel-agents`** | Runs independent tasks in parallel | [SKILL.md](../dispatching-parallel-agents/SKILL.md) |
| **`writing-skills`** | Instructions for authoring new high-quality agent skills | [SKILL.md](../writing-skills/SKILL.md) |

## Antigravity Harness Mapping

- **Subagent Dispatch**: Use `invoke_subagent` with `TypeName: "self"` (full capabilities) or `"research"` (read-only exploration).
- **Task Tracking**: Use Antigravity task artifacts (`write_to_file` in artifact directory).
- **Tool Reference**: See [antigravity-tools.md](../using-superpowers/references/antigravity-tools.md).
