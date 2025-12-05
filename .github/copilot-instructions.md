# BrightScript Engine - AI Agent Instructions

## Project Overview

**brs-engine** is a TypeScript-based interpreter for Roku's BrightScript language that runs on browsers, Node.js, and Electron. It simulates Roku's runtime environment, including the Draw 2D API and SceneGraph framework, enabling Roku app development and testing outside of Roku hardware.

**Key Architecture:**
- **Monorepo structure** with two packages: `packages/browser` (web/Electron) published as `brs-engine` and `packages/node` (CLI/server) published as `brs-node`
- **Web Worker architecture**: Browser package runs interpreter in a Web Worker (`brs.worker.js`) with API library (`brs.api.js`) for host communication
- **Lexer → Parser → Interpreter pipeline**: Code flows through `src/core/lexer` → `src/core/parser` → `src/core/interpreter`
- **Component System**: BrightScript objects live in `src/core/brsTypes/components`, SceneGraph nodes in `src/core/brsTypes/nodes`
- **Device Simulation**: `BrsDevice` (in `src/core/device/`) maintains simulated Roku device state (registry, file system, device info)
- **Roku OS Version**: Currently synchronized with Roku OS 15.0 features and APIs

## Recent Major Improvements (Roku OS 15.0 Sync)

### RoSGNode Refactoring (PR #755, #735)
- **Abstract base class**: `RoSGNode` is now abstract; all nodes must extend either `RoSGNode` or the concrete `Node` class
- **Removed BrsIterable**: Simplified node interface by removing iterable behavior
- **setValue standardization**: Replaced `Set` method with `setValue` throughout the codebase for consistency
- **System field protection**: Added validation to prevent removal of system fields and misuse of `setFields()` for adding fields

### Field System Enhancements (PR #754, #753)
- **Field type validation**: `Field.canAcceptValue()` properly validates array values and types
- **Typed arrays support**: Added `intarray`, `floatarray`, `boolarray`, `stringarray`, `colorarray`, and `timearray` types
- **Type conversion**: Fields automatically convert string values to appropriate types (e.g., "true" → boolean)
- **Array field validation**: Validates that array elements match the expected array element type

### Content Handling Pattern (PR #708, #660)
- **Standardized content caching**: All list/grid nodes now follow the `refreshContent()` pattern
- **setValue override**: Content fields processed in `setValue()` method, triggering `refreshContent()`
- **Performance optimization**: Content only processed once, cached for rendering (prevents repeated `getFieldValue()` calls)
- **Example implementations**: `RowList`, `ZoomRowList`, `ArrayGrid` all use this pattern

### New SceneGraph Nodes
- **LayoutGroup** (PR #699, #714): Automatic horizontal/vertical layout with alignment and spacing
- **ZoomRowList** (PR #700, #714): Advanced row list with zoom effects, configurable row heights, and smooth animations

### File System Improvements (PR #747, #730, #729)
- **Case preservation**: Writeable volumes (`tmp:`, `cachefs:`) now preserve original case in file paths
- **Shared volumes**: `tmp:` and `cachefs:` are shared among threads for proper inter-thread communication
- **Upgraded zenFS**: Latest version of `@zenfs/core` for better virtual file system handling

### Type System Enhancements
- **Uninitialized validation** (PR #756): Raises type mismatch error when passing `Uninitialized` to non-dynamic function parameters
- **Double support** (PR #643, #644, #645): Added `d` flag to `ParseJson()` for parsing to `double` type
- **Type coercion** (PR #642, #641): Typed functions return `0` when no return statement is hit (user functions only)

### API and Library Improvements (PR #751)
- **Task module**: Refactored API to separate task-related functionality into dedicated module
- **LexerParser module** (PR #675): Separated lexer and parser into reusable module for better code organization
- **Screenshot API** (PR #711, #712): New `getScreenshot()` method returns full-resolution `ImageData`

## Development Workflows

### Build & Test
```bash
npm run build          # Build both packages (outputs to packages/*/lib and packages/*/bin)
npm run build:web      # Build browser package and launch dev server
npm run build:cli      # Build Node.js package only
npm run test           # Run Jest tests
npm run start          # Start webpack dev server for browser package
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
- **RoSGNode is now abstract**: All SceneGraph nodes extend `RoSGNode` (abstract) or `Node` (concrete base class)
- **Fields are declared** in `defaultFields: FieldModel[]` array with `name`, `type`, `value`, optional `alwaysNotify`
- **Field system improvements**: Supports typed arrays (`intarray`, `floatarray`, `boolarray`, `stringarray`, `colorarray`, `timearray`)
- **System fields are protected**: Cannot be removed via `removeField()` or added via `addFields()`; use `setFields()` for modifications
- **setValue vs setValueSilent**: `setValue()` triggers observers, `setValueSilent()` does not (used during initialization)
- **Custom rendering** overrides `renderNode()` method, receives `IfDraw2D` context
- **Field observers** use `observeField()` to watch changes
- **Node lifecycle**: `init()` called on creation, `deinit()` on destruction
- See `src/core/brsTypes/nodes/RowList.ts` and `src/core/brsTypes/nodes/ZoomRowList.ts` as complex examples with focus handling and child rendering

## SceneGraph Rendering Architecture

### Node Hierarchy and Base Classes

All SceneGraph nodes inherit from **RoSGNode** (`src/core/brsTypes/components/RoSGNode.ts`), which provides:
- **Field management**: Dynamic field registration with `Field` class, aliases, observers, and notifications
- **Child management**: Parent-child relationships via `ifSGNodeChildren` interface (appendChild, removeChild, etc.)
- **Focus system**: Focus chain tracking via `ifSGNodeFocus` (hasFocus, setFocus, isInFocusChain)
- **Bounding rectangles**: Three coordinate spaces tracked in every node:
  - `rectLocal`: Node's own coordinate space (relative to itself)
  - `rectToParent`: Transformed to parent's coordinate space
  - `rectToScene`: Transformed to root Scene coordinate space
- **Standard fields**: All nodes have `id`, `focusedChild`, `focusable`, `change` fields by default

**Group** (`src/core/brsTypes/nodes/Group.ts`) extends RoSGNode and is the base for all **visual/renderable nodes**:
- **Transform fields**: `translation` [x,y], `rotation` (degrees), `scale` [x,y], `scaleRotateCenter` [x,y], `opacity` (0-1), `visible` (boolean)
- **Layout fields**: `width`, `height`, `clippingRect` for cropping child rendering
- **Child rendering**: `renderChildren()` recursively renders child nodes with inherited transforms
- **Drawing utilities**: Helper methods for text (drawText, drawTextWrap, breakTextIntoLines, ellipsizeLine) and images (drawImage, loadBitmap)
- **Coordinate transforms**: `inheritParentTransform` and `inheritParentOpacity` apply parent values to children
- **Caching**: `isDirty` flag tracks when text measurements need recalculation, `cachedLines` stores text layout

### Node Type Categories

1. **Container Nodes** (manage children, no direct visual output):
   - `Group`: Basic container with transforms
   - `LayoutGroup`: Auto-layout children in rows/columns
   - `Scene`: Root node, sets screen resolution (SD/HD/FHD), background color/image, dialog management

2. **Visual Leaf Nodes** (render content, usually have no children):
   - `Label`: Single/multi-line text with alignment, wrapping, ellipsization
   - `Poster`: Image display with scaling modes (noScale, scaleToFit, scaleToZoom), 9-patch support
   - `Rectangle`: Filled rectangle with color and optional rotation
   - `BusySpinner`: Animated loading indicator

3. **Interactive Container Nodes** (visual + focus + children):
   - `ArrayGrid`: Grid of items with focus management and scrolling (base for grids)
   - `RowList`: Horizontal rows of items, each row is a scrollable list (fully implemented with row titles, focus feedback)
   - `ZoomRowList`: Advanced row list with zoom animations and configurable row heights (fully implemented)
   - `LayoutGroup`: Auto-layout container with horizontal/vertical arrangement and alignment (fully implemented)
   - `MarkupList`/`MarkupGrid`: Similar to above with markup text support
   - `LabelList`, `CheckList`, `RadioButtonList`: Specialized list types
   - `ButtonGroup`, `Button`: Interactive button controls
   - `Keyboard`, `MiniKeyboard`, `TextEditBox`: Input controls

4. **Special Nodes**:
   - `ContentNode`: Data-only node (no rendering), holds metadata for lists/grids
   - `Task`: Background thread execution (runs BrightScript in separate Worker)
   - `Timer`: Interval/timeout events
   - `Video`, `Audio`, `SoundEffect`: Media playback
   - `Dialog`, `KeyboardDialog`, `StandardDialog`: Modal overlays
   - `Font`: Font resource definition

### Rendering Pipeline and Flow

**SceneGraph Rendering Architecture Overview**:
The SceneGraph rendering system is triggered by `roSGScreen` (the display component) and flows through a hierarchy of `renderNode()` method calls. The entry point is always `Scene.renderNode()`, which then recursively calls `renderNode()` on child nodes. This is fundamentally different from a typical DOM-based rendering system - nodes must explicitly implement `renderNode()` to participate in the rendering pipeline.

**Key Principle**: Nodes that want custom rendering behavior MUST override `renderNode()`, not invent new methods like `renderContent()`. Group's base `renderNode()` only calls `renderChildren()` - it has no concept of "content rendering".

**Initialization (SceneGraph bootstrap)**:
1. **Component XML parsing** (`src/core/scenegraph/index.ts`):
   - Scan `pkg:/components/` for `.xml` files
   - Parse XML with `xmldoc` library into `ComponentDefinition` objects
   - Build inheritance tree (components can extend other components or built-in types)
   - Extract `<interface>` (fields/functions), `<children>` (initial child nodes), `<script>` tags
2. **Node factory** (`src/core/scenegraph/SGNodeFactory.ts`):
   - `createNodeByType()` instantiates nodes from string type names
   - Built-in types registered in `SGNodeFactory.createNode()` switch statement
   - Custom components use `ComponentDefinition` to create nodes with inherited fields
3. **Environment setup**:
   - Each component gets its own `Environment` (scope) for BrightScript functions
   - `init()` function called after node creation if defined in component script
   - Field observers registered, initial field values set

**Frame Render Cycle** (triggered by roSGScreen display update):
1. **roSGScreen.renderFrame()** initiates the cycle:
   - Gets the Scene node from `sgRoot.scene`
   - Calls `scene.renderNode(interpreter, [0, 0], 0, 1.0, draw2D)`
   - This is the ONLY entry point to the rendering system

2. **Scene.renderNode()** called with:
   - `interpreter`: Active interpreter instance
   - `origin`: [x, y] position in screen coordinates (starts at [0, 0])
   - `angle`: Accumulated rotation from parent chain (starts at 0)
   - `opacity`: Accumulated opacity from parent chain (starts at 1.0)
   - `draw2D`: `IfDraw2D` interface for canvas drawing

3. **Scene-specific rendering**:
   - Clears canvas with `backgroundColor`
   - Draws `backgroundURI` image if set (scaled to screen resolution)
   - Calls `renderChildren()` to process child nodes

4. **Group.renderNode()** recursion (for each child):
   - **Visibility check**: Skip if `visible` field is false (ALWAYS check this first in custom renderNode)
   - **Transform calculation**:
     - Get node's `translation` field: `nodeTrans = this.getTranslation()`
     - Calculate draw position: `drawTrans = [nodeTrans[0] + origin[0], nodeTrans[1] + origin[1]]`
     - If parent has `angle`, rotate translation vector: `rotateTranslation(nodeTrans, angle)`
   - **Accumulate transforms**:
     - `rotation = parentAngle + this.getRotation()`
     - `opacity = parentOpacity * this.getOpacity()`
   - **Custom node rendering** (nodes override renderNode for this):
     - Simple visual nodes (Label, Poster, Rectangle): Call IfDraw2D methods directly
     - Complex nodes (ArrayGrid, RowList, ZoomRowList): Implement full custom rendering logic
     - Container nodes: Just call `renderChildren()` to delegate to children
   - **Bounding rect updates**:
     - `updateBoundingRects(rect, origin, rotation)`: Updates `rectLocal`, `rectToParent`, `rectToScene`
     - Used for hit testing, collision detection, debugging
   - **Recurse to children**: `renderChildren(interpreter, drawTrans, rotation, opacity, draw2D)`
   - **Parent rect propagation**: `updateParentRects(origin, angle)` updates parent's bounding rects

**Key Rendering Concepts**:
- **Coordinate space transformations**: Every node maintains three rect representations for different use cases (local calculations, parent-relative layout, screen-absolute hit testing)
- **Transform inheritance**: Children accumulate parent transforms (translation, rotation, opacity) at render time
- **Depth-first traversal**: Parents render before children, ensuring proper z-ordering
- **Canvas-based drawing**: All drawing operations use HTML5 Canvas 2D context via `IfDraw2D` interface
- **Lazy evaluation**: Bounding rects and transforms calculated during render pass, not on field changes

**Implementing Custom renderNode()**:
When creating a custom node that needs to render visual content, follow this pattern (see `ArrayGrid.ts`, `RowList.ts`, `ZoomRowList.ts`):

```typescript
renderNode(interpreter: Interpreter, origin: number[], angle: number, opacity: number, draw2D?: IfDraw2D) {
    // 1. ALWAYS check visibility first
    if (!this.isVisible()) {
        return;
    }
    
    // 2. Calculate transforms
    const nodeTrans = this.getTranslation();
    const drawTrans = nodeTrans.slice();
    drawTrans[0] += origin[0];
    drawTrans[1] += origin[1];
    const rotation = angle + this.getRotation();
    opacity = opacity * this.getOpacity();
    
    // 3. Do your custom rendering here
    // - Use draw2D methods for drawing
    // - Access cached data (e.g., this.content)
    // - Create/update item components
    // - Call itemComp.renderNode() for child items
    
    // 4. Update bounding rectangles
    this.rectToScene = { x: drawTrans[0], y: drawTrans[1], width: ..., height: ... };
    this.rectToParent = { x: nodeTrans[0], y: nodeTrans[1], width: ..., height: ... };
    
    // 5. Render children (if any non-content children exist)
    this.renderChildren(interpreter, drawTrans, rotation, opacity, draw2D);
    
    // 6. Update parent rects and mark clean
    this.updateParentRects(origin, angle);
    this.isDirty = false;
}
```

**Common Mistakes to Avoid**:
- ❌ Creating methods like `renderContent()` - Group doesn't call them
- ❌ Calling `getFieldValue()` repeatedly in render loop - cache data in `refreshContent()` or `set()`
- ❌ Forgetting visibility check - causes rendering of invisible nodes
- ❌ Not calling `updateParentRects()` and setting `isDirty = false` - breaks bounding box calculations
- ❌ Not handling the case when content is empty - can cause crashes

### Drawing Interface (IfDraw2D)

**IfDraw2D interface** (`src/core/brsTypes/interfaces/IfDraw2D.ts`) provides BrightScript `ifDraw2D` API:
- **Canvas management**: `doClearCanvas()`, `getContext()`, `getCanvas()`, `getRgbaCanvas()`
- **Basic shapes**: `doDrawLine()`, `doDrawPoint()`, `doDrawRect()`, `doDrawRotatedRect()`
- **Text rendering**: `doDrawText()` with font, color, alignment, rotation support
- **Image drawing**:
  - `doDrawObject()`: Draw bitmap at position
  - `doDrawScaledObject()`: Draw with scale factors
  - `doDrawRotatedObject()`: Draw with rotation around center point
  - `doDrawTransformedObject()`: Combined scale + rotation + translation
  - `doDrawCroppedBitmap()`: Draw portion of bitmap (for sprites, tiling)
- **Collision detection**: `collision()` helper for RectRect, RectCircle, CircleCircle

**BrsDraw2D Components** (implement IfDraw2D for off-screen rendering):
- **RoBitmap** (`src/core/brsTypes/components/RoBitmap.ts`): In-memory image with alpha channel, supports 9-patch borders
- **RoRegion** (`src/core/brsTypes/components/RoRegion.ts`): Sub-region of bitmap for sprite sheets, tiling
- **RoScreen** (`src/core/brsTypes/components/RoScreen.ts`): Double-buffered main screen, SwapBuffers for frame display
- **RoCompositor** (`src/core/brsTypes/components/RoCompositor.ts`): Layer compositor with sprites, z-ordering, collision

**Canvas Pooling**: `createNewCanvas()` and `releaseCanvas()` manage reusable canvas contexts to avoid GC pressure

### Content Handling Pattern

**ArrayGrid/RowList/ZoomRowList Content Processing**:
Nodes that display dynamic content from ContentNode trees follow this pattern:

1. **Content Field in setValue() Method** (note: `set()` method is deprecated, use `setValue()`):
```typescript
setValue(index: string, value: BrsType, alwaysNotify: boolean = false, kind?: FieldKind) {
    const fieldName = index.toLowerCase();
    
    if (fieldName === "content") {
        // First, store the field value
        super.setValue(index, value, alwaysNotify, kind);
        
        // Clear existing item components
        this.itemComps.length = 0; // or this.rowItemComps.length = 0
        
        // Process content into cache
        this.refreshContent();
        
        // Set initial focus if needed
        if (this.content.length > 0 && this.focusIndex < 0) {
            this.focusIndex = 0;
        }
        
        return;
    }
    
    super.setValue(index, value, alwaysNotify, kind);
}
```

2. **refreshContent() Method**:
```typescript
protected refreshContent() {
    // Clear content cache
    this.content.length = 0;
    
    // Get content field value
    const contentNode = this.getFieldValue("content");
    if (!(contentNode instanceof ContentNode)) {
        return;
    }
    
    // Extract children into flat array
    const children = contentNode.getNodeChildren();
    this.content = children.filter((child) => child instanceof ContentNode) as ContentNode[];
    
    // Initialize tracking arrays (focus, scroll, etc.)
    for (let i = 0; i < this.content.length; i++) {
        this.rowFocus[i] = this.rowFocus[i] ?? 0;
        this.rowScrollOffset[i] = this.rowScrollOffset[i] ?? 0;
    }
}
```

3. **Use Cached Content in renderNode()**:
```typescript
renderNode(...) {
    // Use cached content, NOT getFieldValue("content")
    if (this.content.length === 0) {
        return;
    }
    
    for (let i = 0; i < this.content.length; i++) {
        const contentItem = this.content[i]; // Already a ContentNode
        // Render using cached data
    }
}
```

**Key Points**:
- ALWAYS call `super.setValue()` first to store the field value
- NEVER call `getFieldValue("content")` or `getNodeChildren()` in render methods - use cached `this.content` array
- Process content once in `refreshContent()`, use cache everywhere else
- This prevents infinite loops and improves performance
- The `setValue()` method is the modern approach; `set()` is deprecated but maintained for compatibility

### Performance and Caching

- **Text measurement caching**: Group.isDirty + cachedLines avoid re-measuring text on every frame
- **Bitmap texture management**: `TextureManager` (global singleton) caches loaded images by URI
- **Lazy bounding rect updates**: Only recalculated during render pass when transforms change
- **Conditional rendering**: Nodes check `visible` field early to skip invisible subtrees
- **Transform accumulation**: Transforms calculated incrementally down tree, not recalculated from root

### Component Lifecycle

1. **Creation**: `createNode()` or `createChild()` instantiates node, sets initial fields
2. **Initialization**: `init()` BrightScript function called if defined in component
3. **Field changes**: Observers notified, `onChange` callbacks invoked
4. **Rendering**: `renderNode()` called every frame if visible
5. **Focus changes**: `onKeyEvent()` called when node has focus and receives key press
6. **Destruction**: `deinit()` called, observers removed, children destroyed recursively

### Event Handling

- **Key events**: `Scene.handleOnKeyEvent()` walks focus chain from focused node up to Scene
  - Each node's `onKeyEvent()` BrightScript function called if defined
  - If returns `true`, event consumed; if `false`, bubbles to parent
  - Built-in nodes (like Group) have `handleKey()` method for default behavior
- **Field observers**: `observeField()` registers callback (function name or message port) for field changes
- **Timer events**: Timer node posts messages to message port on interval/timeout

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
- **`m.global` is shared**: Changes to `m.global` are now properly shared across Task threads
- **Video/Audio lifecycle**: Must call `.stop()` before destroying player objects or playback continues
- **CORS**: Web apps need CORS proxy for cross-origin `roUrlTransfer` calls (configurable in `DeviceInfo.corsProxy`)
- **System fields protection**: Cannot remove system fields or use `setFields()` to add new fields (use `addFields()` instead)
- **Field type validation**: Field assignment now validates types (e.g., `intarray`, `floatarray`) and converts values appropriately

## Key Files to Reference

- **Core entry**: `src/core/index.ts` - Interpreter initialization and main execution loop
- **API surface**: `src/api/index.ts` - Browser package's public API (see `docs/engine-api.md`)
- **Type definitions**: `src/core/brsTypes/BrsType.ts` - Foundation of type system
- **Device state**: `src/core/device/BrsDevice.ts` - Registry, file system, device info singleton
- **Manifest parsing**: `src/core/common.ts` - `parseManifest()` and device info types
- **SceneGraph bootstrap**: `src/core/scenegraph/index.ts` - Component XML parsing and node tree building
- **Lexer/Parser module**: `src/core/LexerParser.ts` - Separated lexer and parser functions for reusability
- **Field system**: `src/core/brsTypes/nodes/Field.ts` - Field model, type validation, and conversion logic

## Project-Specific Quirks

- **`mod` keyword conflict**: Cannot use `mod` as variable name (BrightScript operator vs identifier)
- **Memory info**: `roAppMemoryMonitor` only accurate in Node.js and Chromium (uses non-standard `performance.memory`)
- **Prettier config**: Use 4-space tabs, 120 char line width (see `package.json`)
- **Branch naming**: Current branch is `scenegraph` (active development of SceneGraph features)
- **Platform detection**: Use `BrsDevice.deviceInfo.customFeatures` array to check host-defined capabilities (e.g., `"touch_controls"`)
- **Virtual File System**: Uses `@zenfs/core` with case-insensitive file system; writeable volumes preserve original case
- **Type coercion**: Functions automatically convert between Integer and Float types when needed
- **Typed returns**: User functions with typed returns automatically return `0` if no return statement is hit

## Documentation

- **Limitations**: See `docs/limitations.md` for unsupported features and known issues
- **Customization**: See `docs/customization.md` for DeviceInfo config and manifest options
- **Contributing**: See `docs/contributing.md` for PR guidelines
