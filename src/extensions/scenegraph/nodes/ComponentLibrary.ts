/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AAMember, BrsString, BrsType } from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { Node } from "./Node";
import { sgRoot } from "../SGRoot";
import { loadComponentLibrary } from "../parser/ComponentLibrary";

/**
 * ComponentLibrary node: downloads a library of custom SceneGraph components so that
 * they can be used in the application with a `libraryId:ComponentName` namespace.
 *
 * The actual download/parsing of declared libraries happens at startup (see the
 * extension's `onBeforeExecute` hook, which scans for `<ComponentLibrary>` declarations).
 * This node mirrors the resulting state through its `loadStatus` field.
 */
export class ComponentLibrary extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "loadStatus", type: "string", value: "none" },
        { name: "id", type: "string" },
        { name: "uri", type: "string" },
    ];
    /** Guards against triggering the load / queuing the deferred notification more than once. */
    private loadTriggered = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ComponentLibrary) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.maybeLoadLibrary();
    }

    /**
     * Triggers library loading once both `uri` and `id` are set.
     * @param index Field name being set
     * @param value New BrightScript value
     * @param alwaysNotify Observer notification override for new fields
     * @param kind Optional explicit field kind
     * @param sync Whether to synchronize this change across threads
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        super.setValue(index, value, alwaysNotify, kind, sync);
        const field = index.toLowerCase();
        if (field === "id" || field === "uri") {
            this.maybeLoadLibrary();
        }
    }

    /**
     * Loads the library once its `uri` and `id` are both known. The library is fetched and
     * compiled synchronously (the BrightScript event loop never yields, so an async load would
     * never complete mid-execution), but the final "ready"/"failed" transition of `loadStatus`
     * is deferred to the next render frame. This way an `observeField("loadStatus", ...)`
     * callback attached after the node is created (or in a component's `init()`) is notified,
     * mirroring a Roku device where the library downloads asynchronously.
     */
    private maybeLoadLibrary() {
        if (this.loadTriggered) {
            return;
        }
        const id = this.getValueJS("id") as string | undefined;
        const uri = this.getValueJS("uri") as string | undefined;
        if (!id || !uri) {
            return;
        }
        this.loadTriggered = true;
        // Show the in-progress state now; emit the final status on the next frame.
        this.setValueSilent("loadStatus", new BrsString("loading"));
        // Synchronously load (no-op if already loaded, e.g. pre-loaded at startup or shared).
        loadComponentLibrary(id, uri);
        sgRoot.addPendingLibraryNotification(() => {
            this.setValue("loadStatus", new BrsString(sgRoot.getLibraryStatus(id) ?? "failed"));
        });
    }
}
