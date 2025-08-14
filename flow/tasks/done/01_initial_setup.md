# Task 1: Initial Project Setup

## Goal

Create the foundational directory structure and install all necessary dependencies for the new modular architecture.

## Steps

1.  **Create Directories**:
    - `src/gateways`: For transport-specific gateways (e.g., `configToWs.ts`).
    - `src/server`: For server-side transport implementations (e.g., `websocket.ts`).
    - `src/lib`: For shared libraries and utilities.

2.  **Update `package.json`**:
    - Add the following dependencies:
        - `"uuid": "^11.1.0"`
        - `"ws": "^8.18.2"`
    - Add the following devDependencies:
        - `"@types/uuid": "^11.1.0"`
        - `"@types/ws": "^8.18.1"`
    - Upgrade `@modelcontextprotocol/sdk` to `^1.15.1`.

3.  **Install Dependencies**:
    - Run `npm install` to fetch the new packages.