# BrightScript Engine - AI Agent Instructions

## Project Overview

**brs-engine** is a TypeScript-based interpreter for Roku's BrightScript language that runs on browsers, Node.js, and Electron. It simulates Roku's runtime environment, including the Draw 2D API and SceneGraph framework, enabling Roku app development and testing outside of Roku hardware.

**Key Architecture:**
- **Monorepo structure** with two packages: `packages/browser` (web/Electron) and `packages/node` (CLI/server)
- **Web Worker architecture**: Browser package runs interpreter in a Web Worker (`brs.worker.js`) with API library (`brs.api.js`) for host communication
- **Lexer → Parser → Interpreter pipeline**: Code flows through `src/core/lexer` → `src/core/parser` → `src/core/interpreter`
- **Component System**: BrightScript objects live in `src/core/brsTypes/components`, SceneGraph nodes in `src/core/brsTypes/nodes`
- **Device Simulation**: `BrsDevice` (in `src/core/device/`) maintains simulated Roku device state (registry, file system, device info)

## Development Workflows

### Build & Test
```bash
yarn build          # Build both packages (outputs to packages/*/lib and packages/*/bin)
yarn build:web      # Build browser package and launch dev server
yarn build:cli      # Build Node.js package only
yarn test           # Run Jest tests
yarn start          # Start webpack dev server for browser package
```

### Key Build Details
- **Webpack** bundles TypeScript using `ts-loader` with separate configs per package
- **ifdef-loader** enables conditional compilation with `/// #if BROWSER`, `/// #if DEBUG`, `/// #else`, `/// #endif` directives
- Browser package creates two bundles: `brs.worker.js` (interpreter) and `brs.api.js` (host API)
- Node package creates three: `brs.cli.js` (CLI), `brs.ecp.js` (ECP server), `brs.node.js` (library)

### Running the CLI
```bash
# After building
./packages/node/bin/brs.cli.js path/to/app.zip
./packages/node/bin/brs.cli.js path/to/script.brs
```

## Code Patterns & Conventions

### BrightScript Type System
- **All BrightScript values implement `BrsType`** from `src/core/brsTypes/BrsType.ts`
- **Primitive types**: `BrsBoolean`, `BrsString`, `Int32`, `Int64`, `Float`, `Double` in `src/core/brsTypes/`
- **Components** (Roku objects like `roArray`, `roAssociativeArray`): Extend `BrsComponent` in `src/core/brsTypes/components/`
- **Nodes** (SceneGraph like `Group`, `RowList`): Extend base node classes in `src/core/brsTypes/nodes/`
- **Callable functions**: Wrap native TypeScript functions using `Callable` class from `src/core/brsTypes/Callable.ts`

Example adding a stdlib function:
```typescript
export const MyFunction = new Callable("myFunction", {
    signature: {
        args: [{ name: "input", type: ValueKind.String }],
        returns: ValueKind.String,
    },
    impl: (_interpreter, input: BrsString) => {
        return new BrsString(input.value.toUpperCase());
    },
});
```

### SceneGraph Node Implementation
- **Fields are declared** in `defaultFields: FieldModel[]` array with `name`, `type`, `value`
- **Custom rendering** overrides `draw()` method, receives `IfDraw2D` context
- **Field observers** use `observeField()` to watch changes
- **Node lifecycle**: `init()` called on creation, `deinit()` on destruction
- See `src/core/brsTypes/nodes/RowList.ts` as a complex example with focus handling and child rendering

### Conditional Compilation
Use preprocessing directives for platform-specific code:
```typescript
/// #if BROWSER
// Browser-only code (uses Web APIs)
/// #else
// Node.js code (uses Node APIs)
/// #endif
```

Common pattern: `src/core/index.ts` uses `/// #if BROWSER` to set up Worker `onmessage` vs Node.js `postMessage` mock

### Communication Patterns
- **Browser**: Host ↔ Worker via `postMessage()` with typed payloads (`AppPayload`, `TaskPayload`)
- **Shared memory**: `SharedArrayBuffer` for control signals between host and Worker (key events, display state)
- **Events**: `BrsDevice.sharedArray` holds inter-thread communication buffer (see `src/core/device/BrsDevice.ts`)

### File System Architecture
- **Virtual FS**: `FileSystem` class (`src/core/device/FileSystem.ts`) uses `@zenfs/core` for in-memory file system
- **Roku volumes**: `pkg:/`, `tmp:/`, `cachefs:/`, `ext1:/` (external) simulated as mount points
- Zip packages auto-extracted to `pkg:/` on execution

### Testing Patterns
- **Jest** tests in `test/` mirror source structure
- **End-to-end tests** in `test/e2e/` run full BrightScript files
- **Simulator tests** in `test/simulator/` contain `.brs` files exercising runtime features
- Use `execute(source)` helper from interpreter tests to run BrightScript code snippets

## Common Tasks

### Adding a New BrightScript Component
1. Create file in `src/core/brsTypes/components/Ro<ComponentName>.ts`
2. Extend `BrsComponent`, implement required interfaces (e.g., `IfArray`, `IfAssociativeArray`)
3. Register in `src/core/stdlib/CreateObject.ts` factory function
4. Add tests in `test/brsTypes/components/`

### Adding a New SceneGraph Node
1. Create file in `src/core/brsTypes/nodes/<NodeName>.ts`
2. Extend appropriate base (`Node`, `Group`, `ArrayGrid`, etc.)
3. Define `defaultFields` with all Roku-documented fields
4. Implement `draw()` for rendering if visual node
5. Register in `SGNodeFactory.ts` node registry

### Working with the Debugger
- **Micro Debugger**: Set breakpoints with `STOP` statement in BrightScript
- **Debug API**: Call `debug("break")` from host to pause interpreter
- **Console integration**: `print` statements route through `BrsDevice.stdout`

## Important Constraints

- **No `eval()`**: BrightScript's `Eval()` not implemented (documented in `limitations.md`)
- **Task threads limited to 10** per app (see `limitations.md`)
- **`m.global` in Tasks**: Changes to `m.global` children not shared across Task threads yet
- **Video/Audio lifecycle**: Must call `.stop()` before destroying player objects or playback continues
- **CORS**: Web apps need CORS proxy for cross-origin `roUrlTransfer` calls (configurable in `DeviceInfo.corsProxy`)

## Key Files to Reference

- **Core entry**: `src/core/index.ts` - Interpreter initialization and main execution loop
- **API surface**: `src/api/index.ts` - Browser package's public API (see `docs/engine-api.md`)
- **Type definitions**: `src/core/brsTypes/BrsType.ts` - Foundation of type system
- **Device state**: `src/core/device/BrsDevice.ts` - Registry, file system, device info singleton
- **Manifest parsing**: `src/core/common.ts` - `parseManifest()` and device info types
- **SceneGraph bootstrap**: `src/core/scenegraph/index.ts` - Component XML parsing and node tree building

## Project-Specific Quirks

- **`mod` keyword conflict**: Cannot use `mod` as variable name (BrightScript operator vs identifier)
- **Memory info**: `roAppMemoryMonitor` only accurate in Node.js and Chromium (uses non-standard `performance.memory`)
- **Prettier config**: Use 4-space tabs, 120 char line width (see `package.json`)
- **Version in alpha**: Current branch (`implement-RowList-node`) is pre-release - expect incomplete SceneGraph features
- **Platform detection**: Use `BrsDevice.deviceInfo.customFeatures` array to check host-defined capabilities (e.g., `"touch_controls"`)

## Documentation

- **Limitations**: See `docs/limitations.md` for unsupported features and known issues
- **Customization**: See `docs/customization.md` for DeviceInfo config and manifest options
- **Contributing**: See `docs/contributing.md` for PR guidelines
