# MyAgent Console Guide

## Overview

`MyAgent` is a workflow-oriented multi-agent runtime operated from the terminal.

This project supports:

- agent-based workflow execution
- dependency-driven step scheduling
- structured JSON outputs
- declarative and model-selected tool execution
- retry and timeout policies
- approval gates
- resumable runs
- event logging
- artifact generation and reuse

The CLI entrypoint is exposed through the project scripts.

## Quick Start

Install dependencies:

```bash
npm install
```

Build the TypeScript project:

```bash
npm run build
```

Validate project configuration:

```bash
npm run dev -- validate
```

Inspect the loaded agents and workflows:

```bash
npm run dev -- inspect
```

## OpenAI API Key

The runtime uses the OpenAI provider.

You can set the API key with an environment variable:

```bash
export OPENAI_API_KEY=your_key_here
```

If the environment variable is not set, the runtime falls back to the value in:

- [myagent.config.json](./myagent.config.json)

## Core CLI Commands

Run the default workflow:

```bash
npm run dev -- run "작업 설명"
```

Run a specific workflow:

```bash
npm run dev -- run "간단한 동화를 만들어줘" --workflow fairy_tale
```

List previous runs:

```bash
npm run dev -- runs
```

Load one run:

```bash
npm run dev -- run:get <runId>
```

Resume a pending run:

```bash
npm run dev -- run:resume <runId>
```

List runtime events:

```bash
npm run dev -- events
```

List events for one run:

```bash
npm run dev -- events --run <runId>
```

List approved gate keys:

```bash
npm run dev -- approvals
```

Approve a gate:

```bash
npm run dev -- approve <approval-key>
```

Revoke a gate:

```bash
npm run dev -- approve:revoke <approval-key>
```

## REPL Mode

Start the interactive REPL:

```bash
npm run dev -- repl
```

The REPL loads project context on startup and supports:

- natural-language workflow execution
- file browsing and reading
- text search
- file write and patch operations
- build and test commands
- plan confirmation and editing
- named plans and reusable templates

Common REPL commands:

- `/help`
- `/context`
- `/refresh`
- `/files [dir]`
- `/read <path>`
- `/search <text>`
- `/write <path>`
- `/patch <path>`
- `/run-build`
- `/run-tests`
- `/runs`
- `/events [runId]`
- `/session`
- `/exit`

Natural language examples:

```text
README.md 읽어줘
approval 검색해줘
햇님 달님 같은 분위기의 짧은 동화를 써줘
README.md 읽고 approval 검색하고 동화 하나 써줘
```

The REPL can auto-select `fairy_tale` for fairy-tale style requests.

## REPL Plans

Multi-step natural language requests are converted into a pending plan first.

Example:

```text
README.md 읽고 approval 검색하고 동화 하나 써줘
```

This becomes a saved plan that you can inspect and execute:

- `/plan`
- `/confirm`
- `/cancel`

Plan editing commands:

- `/plan:drop <index>`
- `/plan:move <from> <to>`
- `/plan:run <index>`
- `/plan:clear`

Plan history and restore:

- `/plan:history`
- `/plan:restore <index>`

Named plans:

- `/plan:names`
- `/plan:save <name>`
- `/plan:load <name>`
- `/plan:export <path>`
- `/plan:import <path>`

REPL plan state files:

- `.myagent/repl-plan.json`
- `.myagent/repl-plan-history.json`
- `.myagent/repl-named-plans.json`

## REPL Templates

Templates let you reuse a pending plan with variables such as `{{keyword}}` or `{{topic}}`.

Template commands:

- `/plan:templates`
- `/plan:template:show <name>`
- `/plan:template:save <name>`
- `/plan:template:load <name> [key=value ...]`
- `/plan:template:update <name>`
- `/plan:template:rename <from> <to>`
- `/plan:template:delete <name>`
- `/plan:template:export <path>`
- `/plan:template:import <path>`

Template loading order for variables:

1. explicit `key=value` arguments
2. saved template defaults
3. interactive prompts for missing values

Example:

```text
/plan:template:show story-check
/plan:template:load story-check keyword=approval
Value for topic: 호랑이
/confirm
```

Template state file:

- `.myagent/repl-plan-templates.json`

## Project Structure

Important files and folders:

- [myagent.config.json](./myagent.config.json): global runtime configuration
- [agents](./agents): agent definitions
- [workflows](./workflows): workflow definitions
- [src/app/cli.ts](./src/app/cli.ts): CLI command handling
- [src/runtime/workflow-executor.ts](./src/runtime/workflow-executor.ts): workflow execution engine
- [src/persistence/run-store.ts](./src/persistence/run-store.ts): run persistence
- [src/persistence/event-store.ts](./src/persistence/event-store.ts): event persistence

Generated runtime data:

- `.myagent/runs/<runId>.json`
- `.myagent/artifacts/<runId>/final.md`
- `.myagent/artifacts/<runId>/steps.json`
- `.myagent/artifacts/<runId>/<stepId>-<fileName>`
- `.myagent/events/<runId>.jsonl`
- `.myagent/approvals.json`
- `.myagent/repl-plan.json`
- `.myagent/repl-plan-history.json`
- `.myagent/repl-named-plans.json`
- `.myagent/repl-plan-templates.json`

## Available Agents

Current agent set:

- `planner`
- `researcher`
- `writer`
- `reviewer`
- `summarizer`
- `extractor`
- `classifier`
- `router`
- `critic`
- `documenter`

Each agent is defined as a JSON file under [agents](./agents).

Typical fields:

- `id`
- `name`
- `role`
- `model`
- `temperature`
- `systemPrompt`
- `allowedTools`

Example:

```json
{
  "id": "summarizer",
  "name": "Summarizer",
  "role": "summary",
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "systemPrompt": "You compress long material into concise summaries.",
  "allowedTools": ["echo", "read_file"]
}
```

## Available Workflows

Current workflows:

- `default`
- `fairy_tale`

Workflows live under [workflows](./workflows).

Example execution:

```bash
npm run dev -- run "햇님 달님 같은 분위기의 짧은 전래동화를 새 줄거리로 만들어줘" --workflow fairy_tale
```

## Workflow Model

Each workflow is composed of `stages`.

Each stage contains `steps`.

Each step can define:

- `dependsOn`: explicit step dependencies
- `structuredOutput`: JSON output contract
- `tools`: declarative tool calls
- `toolSelection`: model-driven tool selection
- `execution`: retry/timeout policy
- `approval`: human approval gate
- `artifacts`: saved output files

Example step:

```json
{
  "id": "draft",
  "agentId": "writer",
  "dependsOn": ["research", "review_prep"],
  "execution": {
    "retryCount": 1,
    "timeoutMs": 15000
  },
  "tools": [
    {
      "tool": "timestamp",
      "as": "generatedAt"
    }
  ],
  "artifacts": [
    {
      "name": "draft_markdown",
      "fileName": "draft.md",
      "contentFrom": "output"
    }
  ],
  "instruction": "Write the final deliverable."
}
```

## Dependencies and Scheduling

The runtime executes workflows as a dependency graph.

Rules:

- if `dependsOn` is defined, that dependency list is used
- if `dependsOn` is omitted, the step depends on all steps from prior stages
- steps whose dependencies are satisfied can run in parallel
- cyclic dependencies are rejected

This means stages are useful for grouping and readability, while actual execution order is controlled by dependencies.

## Structured Outputs

Steps can request validated JSON output.

Example:

```json
{
  "structuredOutput": {
    "fields": {
      "objective": "string",
      "risks": "string[]",
      "approved": "boolean"
    }
  }
}
```

Supported field types:

- `string`
- `string[]`
- `number`
- `boolean`

After execution, these values become available in templates:

- `{{steps.plan.data.objective}}`
- `{{steps.plan.data.risks}}`

## Tool Execution

The runtime supports builtin tools.

Current tools:

- `echo`
- `join`
- `timestamp`
- `read_file`

Declarative tool example:

```json
{
  "tools": [
    {
      "tool": "join",
      "as": "riskList",
      "input": {
        "values": "{{steps.plan.data.risks}}",
        "separator": " | "
      }
    }
  ]
}
```

Use in templates:

- `{{steps.draft.tools.riskList}}`

## Model-Driven Tool Selection

Steps can let the model choose tools dynamically.

Example:

```json
{
  "toolSelection": {
    "enabled": true,
    "maxCalls": 1
  }
}
```

The runtime asks the model to return JSON tool calls, then executes only allowed tools.

## Tool Permission Model

Tool execution is restricted by:

- `workflow.allowedTools`
- `agent.allowedTools`

The effective allowed tool list is the intersection of those two lists when both are present.

If a tool is not allowed, the step fails.

## Execution Policies

Steps can define retry and timeout behavior.

Example:

```json
{
  "execution": {
    "retryCount": 2,
    "timeoutMs": 10000,
    "continueOnError": false
  }
}
```

Behavior:

- `retryCount`: number of retry attempts after failure
- `timeoutMs`: hard timeout for tool/model execution
- `continueOnError`: if true, mark the step as failed and continue

Possible step statuses:

- `completed`
- `skipped`
- `failed`
- `pending_approval`

## Approval Gates

Steps can require explicit approval before execution.

Example:

```json
{
  "approval": {
    "required": true,
    "key": "default:review",
    "message": "Review step requires human approval."
  }
}
```

If approval is missing:

- the step becomes `pending_approval`
- the run status becomes `pending_approval`
- the run can later be resumed

Useful commands:

```bash
npm run dev -- approvals
npm run dev -- approve default:review
npm run dev -- run:resume <runId>
```

## Resumable Runs

If a run stops at an approval gate, you do not need to rerun completed steps.

Resume flow:

1. Run the workflow
2. Inspect the run
3. Approve the required key
4. Resume the run

Example:

```bash
npm run dev -- run "문서 초안 작성"
npm run dev -- runs
npm run dev -- run:get <runId>
npm run dev -- approve default:review
npm run dev -- run:resume <runId>
```

When resumed:

- completed steps are reused
- pending approval steps are retried
- the new run records `resumedFromRunId`

## Artifacts

Steps can emit saved artifacts.

Example:

```json
{
  "artifacts": [
    {
      "name": "story_markdown",
      "fileName": "story.md",
      "contentFrom": "output"
    }
  ]
}
```

Generated references:

- `{{steps.draft.artifacts.story_markdown.path}}`
- `{{steps.draft.artifacts.story_markdown.content}}`

Artifacts are saved into:

- `.myagent/artifacts/<runId>/<stepId>-<fileName>`

## Events and Observability

The runtime emits JSONL events.

Examples:

- `run.started`
- `run.resumed`
- `stage.started`
- `stage.completed`
- `step.started`
- `step.completed`
- `step.reused`
- `step.failed`
- `tool.started`
- `tool.completed`
- `retry`

Inspect them with:

```bash
npm run dev -- events
npm run dev -- events --run <runId>
```

## Common Usage Patterns

### 1. Standard Document Workflow

```bash
npm run dev -- run "회의록을 정리하고 액션 아이템까지 뽑아줘"
```

### 2. Folktale Workflow

```bash
npm run dev -- run "햇님 달님과 비슷한 분위기의 짧은 전래동화를 새 줄거리로 만들어줘" --workflow fairy_tale
```

### 3. Approval-Based Review

```bash
npm run dev -- run "보고서 초안 작성"
npm run dev -- approve default:review
npm run dev -- run:resume <runId>
```

## Troubleshooting

Validation error:

```bash
npm run dev -- validate
```

Check loaded definitions:

```bash
npm run dev -- inspect
```

Check prior runs:

```bash
npm run dev -- runs
```

Check event logs:

```bash
npm run dev -- events --run <runId>
```

If `run` fails in the current environment, the most likely cause is OpenAI network access being unavailable.

## Recommended Next Edits

Good next customizations:

- add new agents under [agents](./agents)
- create a new workflow under [workflows](./workflows)
- define explicit `dependsOn` for clearer DAG execution
- add `structuredOutput` wherever downstream steps depend on specific fields
- add `artifacts` when a step should hand off file content to later steps
- use `approval` for review or release gates

## Minimal Workflow Template

```json
{
  "id": "my_workflow",
  "name": "My Workflow",
  "allowedTools": ["echo"],
  "stages": [
    {
      "id": "plan",
      "steps": [
        {
          "id": "plan",
          "agentId": "planner",
          "instruction": "Plan the work."
        }
      ]
    },
    {
      "id": "draft",
      "steps": [
        {
          "id": "draft",
          "agentId": "writer",
          "dependsOn": ["plan"],
          "instruction": "Write the result using {{steps.plan.output}}"
        }
      ]
    }
  ],
  "output": {
    "finalStepId": "draft",
    "includeSteps": ["plan", "draft"]
  }
}
```
