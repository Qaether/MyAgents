# MyAgent Runtime

OpenAI 기반 멀티 에이전트 워크플로우 런타임입니다.

## 구조

- `myagent.config.json`: 프로젝트 전역 설정
- `agents/`: 에이전트 정의
- `workflows/`: 단계형 워크플로우 정의
- `.myagent/runs`: 실행 이력 JSON
- `.myagent/artifacts`: 실행 산출물
- `src/config`: 설정 로딩 및 검증
- `src/providers`: LLM provider 어댑터
- `src/runtime`: 워크플로우 실행 엔진
- `src/app`: CLI 진입점

## 실행

```bash
npm run dev -- validate
npm run dev -- inspect
npm run dev -- run "사용자 요청"
npm run dev -- repl
npm run dev -- runs
npm run dev -- run:get <run-id>
```

## REPL

대화형 모드는 아래처럼 시작합니다.

```bash
npm run dev -- repl
```

REPL에서는 자연어 실행과 파일 탐색을 같이 할 수 있습니다.

```text
README.md 읽어줘
approval 검색해줘
README.md 읽고 approval 검색하고 동화 하나 써줘
```

복합 요청은 먼저 pending plan으로 저장되고, `/confirm`, `/cancel`, `/plan`으로 제어할 수 있습니다.

상세 사용법은 [CONSOLE_GUIDE.md](./CONSOLE_GUIDE.md)를 참고하면 됩니다.

## 현재 범위

- OpenAI provider만 지원
- 단계형 workflow executor
- planner / researcher / writer / reviewer 샘플 구성

## 설정 주의

기본적으로 `OPENAI_API_KEY` 환경변수를 우선 사용합니다. 값이 없으면 `myagent.config.json`의 `provider.apiKey`를 fallback으로 사용합니다.
