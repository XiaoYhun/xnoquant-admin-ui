## What is this project

A dashboard UI for internal use of XNOQuant team.
This project will reuse many part from xno-builder project in /Develop/xno-builder. For example authentication we will use Firebase mix with access_token get from our AUTH access_token. But we will use another UI lib shadcn/ui.

## Techstacks

Next.js 16
React 19.2
TypeScript
Tailwind CSS v4
shadcn/ui
Zod
React Hook Form
TanStack Query
Zustand
Framer Motion

## API docs

AUTH: https://api.dev.xnoquant.io/auth/swagger_docs/doc.json
HFT: https://hft-dev.xnoquant.io/openapi.json
XALPHA: https://api.dev.xnoquant.io/xalpha-api/swagger_docs/doc.json

For most of API require access_token, get it from https://api.dev.xnoquant.io/auth/v1/auth/token and pass to other API: "Authorization: `Bearer ${access_token}`"

## Design

Figma MCP:
https://www.figma.com/design/B7Hh2GpERHUPyy3Zdv35sY/XNO-QUANT-AI?node-id=13962-19026
Alway check if MCP connected before do UI tasks, notice me right away when it not.

## Design system

Alway try to create primitive components from shadcn/ui, make it match with design
Notice the colors system from figma and alway update tailwindcss config to be reusable tailwind classses.
For font, you can get from xno-builder.
