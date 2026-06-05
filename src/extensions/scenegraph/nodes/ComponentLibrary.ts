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
    /** Guards against queuing the deferred loadStatus notification more than once. */
    private notificationQueued = false;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.ComponentLibrary) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);
        this.refreshLoadStatus();
    }

    /**
     * Re-evaluates the recorded library load status when the `id` changes.
     * @param index Field name being set
     * @param value New BrightScript value
     * @param alwaysNotify Observer notification override for new fields
     * @param kind Optional explicit field kind
     * @param sync Whether to synchronize this change across threads
     */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync: boolean = true) {
        super.setValue(index, value, alwaysNotify, kind, sync);
        if (index.toLowerCase() === "id") {
            this.refreshLoadStatus();
        }
    }

    /**
     * Reflects the recorded load status for this library's `id` into the `loadStatus` field.
     * If the library already finished loading (synchronously, at startup), the final
     * "ready"/"failed" transition is deferred to the next render frame so that observers
     * attached during a component's `init()` are notified — mirroring a Roku device, where
     * the library downloads asynchronously after the scene is constructed.
     */
    private refreshLoadStatus() {
        const id = this.getValueJS("id") as string | undefined;
        if (!id) {
            return;
        }
        const status = sgRoot.getLibraryStatus(id);
        if ((status === "ready" || status === "failed") && !this.notificationQueued) {
            this.notificationQueued = true;
            // Show the in-progress state now; emit the final status on the next frame.
            this.setValueSilent("loadStatus", new BrsString("loading"));
            sgRoot.addPendingLibraryNotification(() => {
                this.notificationQueued = false;
                this.setValue("loadStatus", new BrsString(sgRoot.getLibraryStatus(id) ?? status));
            });
        }
    }
}
