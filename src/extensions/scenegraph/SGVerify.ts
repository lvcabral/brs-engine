/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BrsDevice, Interpreter, Rect } from "brs-engine";
import { sgRoot } from "./SGRoot";
import type { Node } from "./nodes/Node";

/**
 * Rect-diff verifier for the pruned layout refresh (docs/scenegraph-layout-passes.md, Tooling).
 * Runs the refresh pruned, snapshots every rect in the tree, forces a full (unpruned) pass,
 * snapshots again, and reports every divergence as a `[prune-verify]` line naming the exact node.
 * Enabled by BRS_PRUNE_VERIFY=1 (or `sgRoot.pruneVerify = true`); silence means the pruned and
 * full passes agree. Running the pass twice is safe precisely because layout passes are pure —
 * that purity is part of what this verifier proves.
 */

interface RectSnapshot {
    path: string;
    rectLocal: Rect;
    rectToParent: Rect;
    rectToScene: Rect;
}

function isNodeLike(value: unknown): value is Node {
    return (
        typeof value === "object" &&
        value !== null &&
        "rectLocal" in value &&
        "rectToParent" in value &&
        "getNodeChildren" in value
    );
}

/** Builds `/Type[childIndex]#id` path segments, e.g. `/Scene[2]/.../Group#videoTileOverlayGroup`. */
function collectRects(node: Node, path: string, out: RectSnapshot[]) {
    out.push({
        path,
        rectLocal: { ...node.rectLocal },
        rectToParent: { ...node.rectToParent },
        rectToScene: { ...node.rectToScene },
    });
    const children = node.getNodeChildren();
    for (const [index, child] of children.entries()) {
        if (!isNodeLike(child)) {
            continue;
        }
        const id = child.getValueJS("id") as string;
        const segment = `${child.nodeSubtype}${id ? `#${id}` : `[${index}]`}`;
        collectRects(child, `${path}/${segment}`, out);
    }
}

function fmt(rect: Rect): string {
    return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

function sameRect(a: Rect, b: Rect): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Runs the layout refresh pruned, then unpruned TWICE, and classifies every rect divergence:
 *
 * - `[layout-verify]` — the two full passes disagree with each other: the layout is not
 *   idempotent for that node (a convergence bug — the pruned pass merely ran first and read the
 *   pre-convergence value). Pruning is not the culprit; fix the node's layout.
 * - `[prune-verify]` — the two full passes agree but the pruned pass differs: true pruning
 *   unsoundness (a subtree was skipped whose layout inputs changed without a stale mark).
 *
 * @returns The number of diverging nodes (0 = the pruned pass is sound for this refresh).
 */
export function runPruneVerify(root: Node, interpreter: Interpreter): number {
    const pruned: RectSnapshot[] = [];
    const full: RectSnapshot[] = [];
    const fullAgain: RectSnapshot[] = [];

    sgRoot.pruneLayout = !sgRoot.pruneDisabled;
    try {
        root.layoutNode(interpreter, [0, 0], 0, 1);
    } finally {
        sgRoot.pruneLayout = false;
    }
    collectRects(root, `/${root.nodeSubtype}`, pruned);

    root.layoutNode(interpreter, [0, 0], 0, 1);
    collectRects(root, `/${root.nodeSubtype}`, full);

    root.layoutNode(interpreter, [0, 0], 0, 1);
    collectRects(root, `/${root.nodeSubtype}`, fullAgain);

    const fullByPath = new Map(full.map((snapshot) => [snapshot.path, snapshot]));
    const fullAgainByPath = new Map(fullAgain.map((snapshot) => [snapshot.path, snapshot]));
    let divergences = 0;
    for (const snapshot of pruned) {
        const reference = fullByPath.get(snapshot.path);
        const confirmation = fullAgainByPath.get(snapshot.path);
        if (!reference || !confirmation) {
            continue; // tree changed between passes (BrightScript ran inside the refresh)
        }
        for (const key of ["rectLocal", "rectToParent", "rectToScene"] as const) {
            if (!sameRect(reference[key], confirmation[key])) {
                divergences++;
                BrsDevice.stderr.write(
                    `warning,[layout-verify] ${snapshot.path}.${key}: full1=${fmt(reference[key])} full2=${fmt(
                        confirmation[key]
                    )} (non-idempotent layout)`
                );
            } else if (!sameRect(snapshot[key], reference[key])) {
                divergences++;
                BrsDevice.stderr.write(
                    `warning,[prune-verify] ${snapshot.path}.${key}: pruned=${fmt(snapshot[key])} full=${fmt(
                        reference[key]
                    )}`
                );
            }
        }
    }
    return divergences;
}
