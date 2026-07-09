## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. UI verification

Whenever you implement a UI-testable task, you MUST retest it in the real browser using the **Claude in Chrome** connection before considering it done.

- After finished any UI update task, using the **Claude in Chrome** to test the last time if it match the Figma design. Only use one time for each task, do not use too many time for every components inside a big task.
- Verify the change actually works end-to-end: navigate to the affected page, exercise the interaction, and confirm the expected result visually (screenshot / `read_page`) and in the console/network where relevant.
- Do not claim a UI task is complete based only on typecheck, build, or unit tests — observe it in the browser first.
- If the browser/extension is unavailable or the flow can't be driven, say so explicitly instead of silently skipping verification.

## 6. Sub-agents

Only use Fable 5 or Opus to planning, research, test reference... then document tasks and guideline. Then use Sonnet as subagents for implements.
Possible subagents: Planner (which is Fable or Opus), FE developer, tester, code-reviewer.

## 7. Agents skills

For any task, workflow you with more than 5 steps, that you think can be reuse in future, you MUST ask me to create new skills for that agents. Say why and when to use.
Also suggest me any community skills that you may think good for a specific agent - This is job of Planner agent

## 8. Others note

When you are blocked with something or going to stop working, start read user-tasks.md and do it, only actual stop if all user-tasks is marked as done in task-progress.md.
