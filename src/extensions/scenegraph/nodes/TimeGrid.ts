import {
    AAMember,
    Interpreter,
    BrsType,
    BrsString,
    Float,
    Int32,
    isBrsString,
    isNumberComp,
    IfDraw2D,
    Rect,
} from "brs-engine";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { ArrayGrid } from "./ArrayGrid";
import { ContentNode } from "./ContentNode";
import { Font } from "./Font";
import { sgRoot } from "../SGRoot";
import { brsValueOf, jsValueOf } from "../factory/Serializer";

/** Cached parse of one channel's programs (see TimeGrid.channelParseCache). */
interface ChannelParse {
    childCount: number;
    programs: ContentNode[];
    starts: number[];
    durations: number[];
    gaps: boolean[];
}

/**
 * TimeGrid — Electronic Program Guide (EPG) node.
 *
 * Channels are horizontal rows; programs are cells whose width is proportional to their
 * duration relative to the visible time window (the `duration` field, in seconds). A
 * channel-info column sits on one side, a time bar with 30-minute labels on top, and a
 * vertical "now" bar marks the current time.
 *
 * Content model: a single root ContentNode -> one child ContentNode per channel -> one
 * child ContentNode per program (sorted by start time ascending). Channel attrs: TITLE,
 * HDSMALLICONURL. Program attrs: TITLE, PLAYSTART (unix seconds), PLAYDURATION (seconds),
 * HDSMALLICONURL.
 *
 * Deferred (registered but not yet behavioral): Now/Next mode, custom
 * `channelInfoComponentName` rendering, `autoDismissTime`, and animation tweening (jumps
 * are applied instantly).
 */
export class TimeGrid extends ArrayGrid {
    readonly defaultFields: FieldModel[] = [
        // Node sizing (EPG fills from its translation to scene bottom-right when 0)
        { name: "width", type: "float", value: "0.0" },
        { name: "height", type: "float", value: "0.0" },
        // General settings
        { name: "maxDays", type: "integer", value: "7" },
        { name: "contentStartTime", type: "integer", value: "0" },
        { name: "duration", type: "double", value: "9000" },
        { name: "autoDismissTime", type: "integer", value: "0" },
        { name: "ignoreTrickPlayKeys", type: "boolean", value: "false" },
        { name: "overlayBitmapUri", type: "string", value: "" },
        { name: "overlayHeight", type: "float", value: "0" },
        // Channel selection / focus
        { name: "animateToChannel", type: "integer", value: "0", alwaysNotify: true },
        { name: "jumpToChannel", type: "integer", value: "0", alwaysNotify: true },
        { name: "jumpToTime", type: "string", value: "", alwaysNotify: true },
        { name: "leftEdgeTargetTime", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelUnfocused", type: "integer", value: "0", alwaysNotify: true },
        // Channel info column
        { name: "channelInfoComponentName", type: "string", value: "" },
        { name: "channelInfoSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelInfoFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelInfoUnfocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelInfoFocusable", type: "boolean", value: "false" },
        { name: "jumpToChannelInfo", type: "integer", value: "0", alwaysNotify: true },
        { name: "channelInfoWidth", type: "float", value: "0" },
        { name: "infoGridGap", type: "float", value: "0" },
        { name: "channelInfoColumnLabel", type: "string", value: "" },
        { name: "channelInfoTextColor", type: "color", value: "0xffffffff" },
        { name: "channelInfoFont", type: "font", value: "font:MediumSystemFont" },
        { name: "channelInfoBackgroundBitmapUri", type: "string", value: "" },
        { name: "channelInfoAlignment", type: "string", value: "left" },
        // Program grid
        { name: "programTitleFocusedColor", type: "color", value: "0x262626ff" },
        { name: "programTitleColor", type: "color", value: "0xffffffff" },
        { name: "programTitleFont", type: "font", value: "font:MediumSystemFont" },
        { name: "programSelected", type: "integer", value: "0", alwaysNotify: true },
        { name: "programFocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "programUnfocused", type: "integer", value: "0", alwaysNotify: true },
        { name: "programFocusedDetails", type: "assocarray" },
        { name: "jumpToProgram", type: "integer", value: "0", alwaysNotify: true },
        { name: "programHorizMargin", type: "float", value: "14" },
        { name: "programBackgroundBitmapUri", type: "string", value: "" },
        { name: "fillProgramGaps", type: "boolean", value: "false" },
        { name: "automaticLoadingDataFeedback", type: "boolean", value: "true" },
        { name: "showLoadingDataFeedback", type: "boolean", value: "false" },
        { name: "loadingDataText", type: "string", value: "Loading Data…" },
        { name: "channelNoDataText", type: "string", value: "No Data Available" },
        // Past time screen
        { name: "showPastTimeScreen", type: "boolean", value: "true" },
        { name: "pastTimeScreenBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "pastTimeScreenBitmapUri", type: "string", value: "" },
        // Time bar
        { name: "timeBarHeight", type: "float", value: "50" },
        { name: "timeBarBitmapUri", type: "string", value: "" },
        { name: "timeLabelColor", type: "color", value: "0xffffff99" },
        { name: "timeLabelFont", type: "font", value: "font:SmallSystemFont" },
        { name: "timeLabelOffset", type: "float", value: "14" },
        // Now bar
        { name: "nowBarWidth", type: "float", value: "0" },
        { name: "nowBarHeight", type: "float", value: "0" },
        { name: "nowBarBitmapUri", type: "string", value: "" },
        { name: "nowBarBlendColor", type: "color", value: "0xFFFFFFFF" },
        { name: "nowBarOffset", type: "integer", value: "0" },
        { name: "minimumNowBarOffset", type: "integer", value: "300" },
        // Now/Next mode (deferred — registered so writes do not error)
        { name: "nowNextMode", type: "boolean", value: "false" },
        { name: "nowBackgroundBitmapUri", type: "string", value: "" },
        { name: "nextBackgroundBitmapUri", type: "string", value: "" },
        { name: "nowNextHideAmPm", type: "boolean", value: "false" },
        { name: "programNowNextTimeColor", type: "color", value: "0xffffff99" },
        { name: "programNowNextTimeFocusedColor", type: "color", value: "0x000000ff" },
        { name: "programNowNextHorizMargin", type: "float", value: "14" },
        { name: "programNowNextTimeTitleGap", type: "float", value: "15" },
    ];

    protected readonly focusUri = "common:/images/focus_grid.9.png";

    // Per-channel program model
    protected readonly channels: ContentNode[] = [];
    protected readonly programs: ContentNode[][] = [];
    protected readonly programStart: number[][] = [];
    protected readonly programDuration: number[][] = [];
    protected readonly gapFlags: boolean[][] = [];
    protected readonly programIndexByChannel: number[] = [];
    // Cache of each channel's parsed program model, keyed by the channel ContentNode. refreshContent
    // reuses a channel's parse while its child count is unchanged, so re-parsing (and the gap-node
    // allocation it does) only happens for channels that actually gained programs — not the whole
    // tree on every content change. Without this, incrementally loading N channels re-parses the
    // entire tree N times (O(N²) allocation), which OOMs V8 on large EPG data.
    private readonly channelParseCache = new WeakMap<ContentNode, ChannelParse>();

    // Navigation / time-domain state
    protected channelIndex: number = 0;
    protected viewStartTime: number = 0;
    protected inChannelInfoColumn: boolean = false;
    // True until focus has been resolved to a real program. The initial focus is often set while
    // the focused channel is still empty (SGDEX assigns `content` before its rows lazy-load their
    // programs), leaving focus on a placeholder program 0. Once the channel gains programs we snap
    // focus to the program at the current view time so the highlight is visible and the grid scrolls
    // to it — matching Roku, instead of leaving focus on an off-screen program until the user moves.
    protected initialFocusPending: boolean = true;

    // Per-render layout caches (read by navigation between renders)
    protected gridX: number = 0;
    protected gridWidth: number = 0;
    protected rowHeight: number = 0;
    protected visibleChannels: number = 0;

    constructor(initializedFields: AAMember[] = [], readonly name: string = SGNodeType.TimeGrid) {
        super([], name);
        this.setExtendsType(name, SGNodeType.ArrayGrid);

        this.registerDefaultFields(this.defaultFields);
        this.registerInitializedFields(initializedFields);

        if (this.resolution === "FHD") {
            this.setValueSilent("channelInfoWidth", new Float(360));
            this.setValueSilent("nowBarWidth", new Float(3));
        } else {
            this.setValueSilent("channelInfoWidth", new Float(240));
            this.setValueSilent("nowBarWidth", new Float(2));
        }
        this.setValueSilent("focusBitmapUri", new BrsString(this.focusUri));
        this.setValueSilent("focusFootprintBitmapUri", new BrsString("common:/images/focus_footprint.9.png"));
        // Initialize to a valid AA so reads never return invalid (matches Roku, which keeps
        // this field populated alongside channelFocused/programFocused).
        this.setValueSilent("programFocusedDetails", brsValueOf({ focusChannelIndex: 0, focusIndex: 0 }));
        this.numCols = 1;
        this.numRows = (this.getValueJS("numRows") as number) ?? 0;
        this.hasNinePatch = true;
        this.focusField = "timeGridHasFocus";
        this.focusIndex = 0;
        this.programIndexByChannel[0] = 0;
    }

    /**
     * On gaining focus, (re)emit the focus event so observers fire — matching Roku, where
     * focusing the grid notifies channelFocused/programFocused (both alwaysNotify) even
     * before content has loaded. SGDEX's TimeGrid content manager relies on this to start
     * lazy content loading when `content` was assigned before the view was shown.
     *
     * The base ArrayGrid.setNodeFocus only re-focuses when `itemFocused >= 0`, but TimeGrid
     * tracks channel/program focus separately and never sets `itemFocused` (it stays -1), so
     * without this override an empty TimeGrid stays silent on focus and never triggers loading.
     */
    setNodeFocus(focusOn: boolean): boolean {
        const focus = super.setNodeFocus(focusOn);
        if (focus) {
            const ch = this.channelIndex;
            const prog = this.programIndexByChannel[ch] ?? 0;
            if (this.channels.length > 0) {
                this.focusCell(ch, prog);
            } else {
                // No content yet: still notify so observers (e.g. the lazy loader) fire.
                super.setValue("channelFocused", new Int32(ch));
                super.setValue("programFocused", new Int32(prog));
            }
        }
        return focus;
    }

    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind) {
        const fieldName = index.toLowerCase();
        if ((fieldName === "jumptochannel" || fieldName === "animatetochannel") && isNumberComp(value)) {
            super.setValue(index, value, alwaysNotify, kind);
            this.jumpToChannel(jsValueOf(value) as number);
            return;
        } else if (fieldName === "jumptoprogram" && isNumberComp(value)) {
            super.setValue(index, value, alwaysNotify, kind);
            this.focusCell(this.channelIndex, jsValueOf(value) as number);
            return;
        } else if (fieldName === "jumptochannelinfo" && isNumberComp(value)) {
            super.setValue(index, value, alwaysNotify, kind);
            this.jumpToChannelInfo(jsValueOf(value) as number);
            return;
        } else if (fieldName === "jumptotime" && isBrsString(value)) {
            super.setValue(index, value, alwaysNotify, kind);
            this.jumpToTime(value.toString());
            return;
        } else if (fieldName === "leftedgetargettime" && isNumberComp(value)) {
            super.setValue(index, value, alwaysNotify, kind);
            this.scrollToTime(jsValueOf(value) as number);
            return;
        } else if (fieldName === "content") {
            // A newly assigned content tree needs its focus (re)resolved once programs are present.
            this.initialFocusPending = true;
        }
        // `content` falls through to ArrayGrid.setValue, which calls refreshContent()
        // (overridden below) then setFocusedItem(0) (overridden below).
        super.setValue(index, value, alwaysNotify, kind);
    }

    /** Parse the root -> channels -> programs content tree into the per-channel model. */
    protected refreshContent() {
        this.content.length = 0;
        this.channels.length = 0;
        this.programs.length = 0;
        this.programStart.length = 0;
        this.programDuration.length = 0;
        this.gapFlags.length = 0;
        const content = this.getValue("content");
        if (!(content instanceof ContentNode)) {
            return;
        }
        const fillGaps = (this.getValueJS("fillProgramGaps") as boolean) ?? false;
        const noDataText = (this.getValueJS("channelNoDataText") as string) ?? "No Data Available";
        const channelNodes = this.getContentChildren(content);
        for (const [ch, channelNode] of channelNodes.entries()) {
            const childCount = channelNode.getNodeChildren().length;
            // Reuse the cached parse while the channel's child count is unchanged — only re-parse
            // (and re-allocate its gap nodes) a channel that actually gained/lost programs.
            let parse = this.channelParseCache.get(channelNode);
            if (parse?.childCount !== childCount) {
                parse = this.parseChannel(channelNode, childCount, fillGaps, noDataText);
                this.channelParseCache.set(channelNode, parse);
            }
            this.content.push(channelNode);
            this.channels.push(channelNode);
            this.programs.push(parse.programs);
            this.programStart.push(parse.starts);
            this.programDuration.push(parse.durations);
            this.gapFlags.push(parse.gaps);
            this.programIndexByChannel[ch] ??= 0;
        }
        if (this.viewStartTime === 0) {
            const cst = (this.getValueJS("contentStartTime") as number) ?? 0;
            this.viewStartTime = cst > 0 ? cst : this.nowEpoch();
        }
        // If focus is still on the placeholder (content was assigned while the focused channel was
        // empty), now that its programs have loaded, snap focus to the program at the view time.
        // This scrolls the grid to the focused program and makes its highlight visible, instead of
        // leaving focus on program 0 (which usually starts before the visible window).
        if (this.initialFocusPending && (this.programs[this.channelIndex]?.length ?? 0) > 0) {
            this.focusCell(this.channelIndex, this.programIndexAtTime(this.channelIndex, this.viewStartTime));
        }
    }

    /** Parses one channel's program children into the cached model (with optional gap fill). */
    private parseChannel(
        channelNode: ContentNode,
        childCount: number,
        fillGaps: boolean,
        noDataText: string
    ): ChannelParse {
        const programNodes = this.getContentChildren(channelNode);
        const programs: ContentNode[] = [];
        const starts: number[] = [];
        const durations: number[] = [];
        const gaps: boolean[] = [];
        let prevEnd: number | null = null;
        for (const program of programNodes) {
            const start = this.readEpoch(program, "PLAYSTART");
            const dur = this.readSeconds(program, "PLAYDURATION");
            if (fillGaps && prevEnd !== null && start > prevEnd) {
                const gapNode = new ContentNode("_nodata_");
                gapNode.setValueSilent("title", new BrsString(noDataText));
                programs.push(gapNode);
                starts.push(prevEnd);
                durations.push(start - prevEnd);
                gaps.push(true);
            }
            programs.push(program);
            starts.push(start);
            durations.push(dur);
            gaps.push(false);
            prevEnd = start + dur;
        }
        return { childCount, programs, starts, durations, gaps };
    }

    /** Reads a unix-epoch (seconds) field, tolerating either an integer or roDateTime value. */
    protected readEpoch(node: ContentNode, field: string): number {
        const value = node.getValueJS(field);
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        const coerced = Number(value);
        return Number.isFinite(coerced) ? coerced : 0;
    }

    /** Reads a duration field (seconds) as a number. */
    protected readSeconds(node: ContentNode, field: string): number {
        const value = node.getValueJS(field);
        const num = typeof value === "number" ? value : Number(value);
        return Number.isFinite(num) && num > 0 ? num : 0;
    }

    protected nowEpoch(): number {
        return Math.floor(Date.now() / 1000);
    }

    protected getDurationSec(): number {
        const duration = this.getValueJS("duration") as number;
        return Number.isFinite(duration) && duration > 0 ? duration : 9000;
    }

    /**
     * Index of the last program in `ch` starting at or before `time` (clamped to range).
     * `programStart[ch]` is ascending, so this is a binary search — called per channel every
     * render to skip straight to the first visible program (avoids scanning off-screen programs).
     */
    protected programIndexAtTime(ch: number, time: number): number {
        const starts = this.programStart[ch] ?? [];
        if (starts.length === 0 || starts[0] > time) {
            return 0;
        }
        let lo = 0;
        let hi = starts.length - 1;
        let idx = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (starts[mid] <= time) {
                idx = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return idx;
    }

    private clamp(value: number, min: number, max: number): number {
        if (max < min) {
            return min;
        }
        return Math.max(min, Math.min(value, max));
    }

    /** Initial focus when content is (re)assigned — `index` is treated as a channel index. */
    protected setFocusedItem(index: number) {
        if (this.channels.length === 0) {
            return;
        }
        const ch = this.clamp(index, 0, this.channels.length - 1);
        this.focusCell(ch, this.programIndexAtTime(ch, this.viewStartTime));
    }

    /**
     * Central focus mutator: updates channel/program focus and fires the read-only events.
     * @param scroll When true (default, horizontal moves and jumps) the time window scrolls to
     *   reveal the focused program. Vertical moves pass false to keep the window fixed — Roku does
     *   not scroll the grid horizontally when changing rows.
     */
    protected focusCell(newChannel: number, newProgram: number, scroll: boolean = true) {
        if (this.channels.length === 0) {
            return;
        }
        newChannel = this.clamp(newChannel, 0, this.channels.length - 1);
        const progs = this.programs[newChannel] ?? [];
        newProgram = progs.length > 0 ? this.clamp(newProgram, 0, progs.length - 1) : 0;
        if (progs.length > 0) {
            // Focus is now on a real program; no longer a placeholder awaiting content.
            this.initialFocusPending = false;
        }
        const oldChannel = this.channelIndex;
        const oldProgram = this.programIndexByChannel[oldChannel] ?? 0;
        if (oldProgram !== newProgram || oldChannel !== newChannel) {
            super.setValue("programUnfocused", new Int32(oldProgram));
        }
        if (oldChannel !== newChannel) {
            super.setValue("channelUnfocused", new Int32(oldChannel));
        }
        this.channelIndex = newChannel;
        this.focusIndex = newChannel;
        this.programIndexByChannel[newChannel] = newProgram;
        this.inChannelInfoColumn = false;
        // Set the combined details first so observers of channelFocused/programFocused
        // (which both notify below) always read an up-to-date programFocusedDetails.
        super.setValue("programFocusedDetails", brsValueOf({ focusChannelIndex: newChannel, focusIndex: newProgram }));
        super.setValue("channelFocused", new Int32(newChannel));
        super.setValue("programFocused", new Int32(newProgram));
        if (scroll) {
            this.ensureProgramVisible(newChannel, newProgram);
        }
        this.updateTopRow();
        this.isDirty = true;
    }

    /** Scrolls the time window so the focused program is fully visible. */
    protected ensureProgramVisible(ch: number, prog: number) {
        const progs = this.programs[ch] ?? [];
        if (progs.length === 0) {
            return;
        }
        const duration = this.getDurationSec();
        const pStart = this.programStart[ch][prog];
        const pEnd = pStart + this.programDuration[ch][prog];
        const viewEnd = this.viewStartTime + duration;
        let changed = false;
        if (pStart < this.viewStartTime) {
            this.viewStartTime = pStart;
            changed = true;
        } else if (pEnd > viewEnd) {
            this.viewStartTime = pEnd - duration;
            changed = true;
        }
        this.clampViewStart();
        if (changed) {
            super.setValue("leftEdgeTargetTime", new Int32(Math.floor(this.viewStartTime)));
        }
    }

    protected clampViewStart() {
        const cst = (this.getValueJS("contentStartTime") as number) ?? 0;
        if (cst > 0) {
            const maxDays = (this.getValueJS("maxDays") as number) ?? 7;
            const duration = this.getDurationSec();
            const upper = Math.max(cst, cst + maxDays * 86400 - duration);
            this.viewStartTime = this.clamp(this.viewStartTime, cst, upper);
        }
    }

    /** Keeps the focused channel within the vertically visible window. */
    protected updateTopRow() {
        const visible = this.visibleChannels || this.numRows || 1;
        if (this.channelIndex < this.topRow) {
            this.topRow = this.channelIndex;
        } else if (this.channelIndex > this.topRow + visible - 1) {
            this.topRow = this.channelIndex - visible + 1;
        }
        const maxTop = Math.max(0, this.channels.length - visible);
        this.topRow = Math.max(0, Math.min(this.topRow, maxTop));
    }

    protected pageSize(): number {
        return Math.min(Math.max(1, this.channels.length - 1), this.visibleChannels || this.numRows || 6);
    }

    handleKey(key: string, press: boolean): boolean {
        const ignoreTrick = (this.getValueJS("ignoreTrickPlayKeys") as boolean) ?? false;
        if (ignoreTrick && (key === "rewind" || key === "fastforward" || key === "instantreplay")) {
            return false;
        }
        if (key === "instantreplay") {
            if (press) {
                this.jumpToNow();
            }
            return true;
        }
        return super.handleKey(key, press);
    }

    protected handleUpDown(key: string) {
        if (this.channels.length === 0) {
            return false;
        }
        let offset: number;
        if (key === "up") {
            offset = -1;
        } else if (key === "down") {
            offset = 1;
        } else if (key === "rewind") {
            offset = -this.pageSize();
        } else if (key === "fastforward") {
            offset = this.pageSize();
        } else {
            return false;
        }
        if (this.inChannelInfoColumn) {
            const next = this.clamp(this.channelIndex + offset, 0, this.channels.length - 1);
            if (next === this.channelIndex) {
                return false;
            }
            super.setValue("channelInfoUnfocused", new Int32(this.channelIndex));
            this.channelIndex = next;
            this.focusIndex = next;
            super.setValue("channelInfoFocused", new Int32(next));
            this.updateTopRow();
            this.isDirty = true;
            return true;
        }
        const next = this.channelIndex + offset;
        if (next < 0 || next >= this.channels.length) {
            return false;
        }
        const curProg = this.programIndexByChannel[this.channelIndex] ?? 0;
        const curStart = this.programStart[this.channelIndex]?.[curProg] ?? this.viewStartTime;
        // Anchor to the focused program's start, clamped into the visible window, so the program
        // airing at that time in the next channel is always at least partially on screen (the
        // focused program often starts before the left edge). Keep the window fixed (scroll=false).
        const anchorTime = this.clamp(curStart, this.viewStartTime, this.viewStartTime + this.getDurationSec());
        this.focusCell(next, this.programIndexAtTime(next, anchorTime), false);
        return true;
    }

    protected handlePageUpDown(key: string) {
        return this.handleUpDown(key);
    }

    protected handleLeftRight(key: string) {
        if (this.channels.length === 0) {
            return false;
        }
        const ch = this.channelIndex;
        if (key === "left") {
            if (this.inChannelInfoColumn) {
                return false;
            }
            const cur = this.programIndexByChannel[ch] ?? 0;
            if (cur <= 0) {
                if ((this.getValueJS("channelInfoFocusable") as boolean) ?? false) {
                    this.enterChannelInfo();
                    return true;
                }
                return false;
            }
            this.focusCell(ch, cur - 1);
            return true;
        }
        // right
        if (this.inChannelInfoColumn) {
            this.exitChannelInfo();
            return true;
        }
        const cur = this.programIndexByChannel[ch] ?? 0;
        const progs = this.programs[ch] ?? [];
        if (cur >= progs.length - 1) {
            return this.scrollTimeRight();
        }
        this.focusCell(ch, cur + 1);
        return true;
    }

    protected handleOK(press: boolean) {
        if (!press || this.channels.length === 0) {
            return false;
        }
        if (this.inChannelInfoColumn) {
            super.setValue("channelInfoSelected", new Int32(this.channelIndex));
            return true;
        }
        const prog = this.programIndexByChannel[this.channelIndex] ?? 0;
        // Set channelSelected first so an observer of programSelected (the common trigger)
        // reads the matching channel index rather than a stale one.
        super.setValue("channelSelected", new Int32(this.channelIndex));
        super.setValue("programSelected", new Int32(prog));
        return true;
    }

    protected enterChannelInfo() {
        this.inChannelInfoColumn = true;
        super.setValue("channelInfoFocused", new Int32(this.channelIndex));
        this.isDirty = true;
    }

    protected exitChannelInfo() {
        this.inChannelInfoColumn = false;
        super.setValue("channelInfoUnfocused", new Int32(this.channelIndex));
        const prog = this.programIndexByChannel[this.channelIndex] ?? 0;
        super.setValue("programFocusedDetails", brsValueOf({ focusChannelIndex: this.channelIndex, focusIndex: prog }));
        super.setValue("channelFocused", new Int32(this.channelIndex));
        super.setValue("programFocused", new Int32(prog));
        this.isDirty = true;
    }

    protected scrollTimeRight() {
        const duration = this.getDurationSec();
        const before = this.viewStartTime;
        this.viewStartTime += duration / 2;
        this.clampViewStart();
        if (this.viewStartTime !== before) {
            super.setValue("leftEdgeTargetTime", new Int32(Math.floor(this.viewStartTime)));
            this.isDirty = true;
            return true;
        }
        return false;
    }

    protected jumpToChannel(n: number) {
        if (this.channels.length === 0) {
            return;
        }
        const ch = this.clamp(n, 0, this.channels.length - 1);
        this.topRow = ch;
        this.focusCell(ch, this.programIndexAtTime(ch, this.viewStartTime));
    }

    protected jumpToChannelInfo(n: number) {
        if (this.channels.length === 0 || !((this.getValueJS("channelInfoFocusable") as boolean) ?? false)) {
            return;
        }
        const ch = this.clamp(n, 0, this.channels.length - 1);
        this.channelIndex = ch;
        this.focusIndex = ch;
        this.inChannelInfoColumn = true;
        this.updateTopRow();
        super.setValue("channelInfoFocused", new Int32(ch));
        this.isDirty = true;
    }

    protected jumpToTime(utc: string) {
        const epoch = Math.floor(Date.parse(utc) / 1000);
        if (!Number.isFinite(epoch)) {
            return;
        }
        this.viewStartTime = epoch;
        this.clampViewStart();
        super.setValue("leftEdgeTargetTime", new Int32(Math.floor(this.viewStartTime)));
        this.focusCell(this.channelIndex, this.programIndexAtTime(this.channelIndex, epoch));
    }

    protected scrollToTime(epoch: number) {
        if (!Number.isFinite(epoch) || this.channels.length === 0) {
            return;
        }
        this.viewStartTime = epoch;
        this.clampViewStart();
        this.focusCell(this.channelIndex, this.programIndexAtTime(this.channelIndex, this.viewStartTime));
    }

    protected jumpToNow() {
        const now = this.nowEpoch();
        const duration = this.getDurationSec();
        this.viewStartTime = now - duration / 3;
        this.clampViewStart();
        super.setValue("leftEdgeTargetTime", new Int32(Math.floor(this.viewStartTime)));
        if (this.channels.length > 0) {
            this.focusCell(this.channelIndex, this.programIndexAtTime(this.channelIndex, now));
        }
    }

    protected renderContent(
        interpreter: Interpreter,
        rect: Rect,
        rotation: number,
        opacity: number,
        draw2D?: IfDraw2D
    ) {
        const dims = this.getDimensions();
        const totalW = dims.width > 0 ? dims.width : this.sceneRect.width - rect.x;
        const totalH = dims.height > 0 ? dims.height : this.sceneRect.height - rect.y;
        // Mutating rect.width/height makes the inherited updateBoundingRects (called after
        // this method in ArrayGrid.renderNode) cover the full grid region.
        rect.width = totalW;
        rect.height = totalH;

        const isFHD = this.resolution === "FHD";
        const timeBarH = (this.getValueJS("timeBarHeight") as number) || 50;
        if (this.channels.length === 0) {
            if (this.shouldShowLoading()) {
                this.renderLoading(
                    { x: rect.x, y: rect.y + timeBarH, width: totalW, height: totalH - timeBarH },
                    opacity,
                    draw2D
                );
            }
            return;
        }

        const infoWidth = (this.getValueJS("channelInfoWidth") as number) || (isFHD ? 360 : 240);
        const infoGap = (this.getValueJS("infoGridGap") as number) || 0;
        const alignRight = ((this.getValueJS("channelInfoAlignment") as string) || "left").toLowerCase() === "right";
        const duration = this.getDurationSec();

        const gridTop = rect.y + timeBarH;
        const gridAreaH = totalH - timeBarH;
        // Roku uses a fixed, compact row height; numRows only controls how many rows are
        // visible (the grid does not stretch rows to fill its height).
        this.rowHeight = isFHD ? 80 : 54;
        const numRows = (this.getValueJS("numRows") as number) || 0;
        const maxFit = Math.max(1, Math.floor(gridAreaH / this.rowHeight));
        this.visibleChannels = numRows > 0 ? Math.min(numRows, maxFit) : maxFit;
        const rowHeight = this.rowHeight;
        const visible = this.visibleChannels;

        const infoX = alignRight ? rect.x + totalW - infoWidth : rect.x;
        this.gridX = alignRight ? rect.x : rect.x + infoWidth + infoGap;
        this.gridWidth = totalW - infoWidth - infoGap;
        const secToPx = this.gridWidth / duration;
        this.updateTopRow();
        const topCh = this.topRow;
        const now = this.nowEpoch();
        const center = this.getScaleRotateCenter();
        const nodeFocus = sgRoot.focused === this;
        let textIndex = 0;

        // --- Time bar ---
        const timeBarBmp = this.getBitmap("timeBarBitmapUri");
        if (timeBarBmp) {
            this.drawImage(
                timeBarBmp,
                { x: this.gridX, y: rect.y, width: this.gridWidth, height: timeBarH },
                0,
                opacity,
                draw2D
            );
        }
        const headerText = (this.getValueJS("channelInfoColumnLabel") as string) || this.dayLabel(this.viewStartTime);
        const infoFont = this.getValue("channelInfoFont") as Font;
        const infoColor = this.getValueJS("channelInfoTextColor") as number;
        const infoPad = isFHD ? 20 : 14;
        this.drawText(
            headerText,
            infoFont,
            infoColor,
            opacity,
            { x: infoX + infoPad, y: rect.y, width: infoWidth - infoPad, height: timeBarH },
            "left",
            "center",
            0,
            draw2D,
            "...",
            textIndex++
        );
        const timeLabelFont = this.getValue("timeLabelFont") as Font;
        const timeLabelColor = this.getValueJS("timeLabelColor") as number;
        const timeLabelOffset = (this.getValueJS("timeLabelOffset") as number) ?? 14;
        const slot = 1800;
        const labelWidth = slot * secToPx;
        const viewEnd = this.viewStartTime + duration;
        let firstLabel = true;
        for (let t = Math.ceil(this.viewStartTime / slot) * slot; t < viewEnd; t += slot) {
            const x = this.gridX + (t - this.viewStartTime) * secToPx;
            // The leftmost label carries the date for context (e.g. "Jun 11, 11:30 am").
            const label = firstLabel ? `${this.monthDayLabel(t)}, ${this.formatClock(t)}` : this.formatClock(t);
            firstLabel = false;
            this.drawText(
                label,
                timeLabelFont,
                timeLabelColor,
                opacity,
                { x: x + timeLabelOffset, y: rect.y, width: labelWidth, height: timeBarH },
                "left",
                "center",
                0,
                draw2D,
                "...",
                textIndex++
            );
        }

        // --- Channel rows ---
        const programFont = this.getValue("programTitleFont") as Font;
        const programColor = this.getValueJS("programTitleColor") as number;
        const programFocusColor = this.getValueJS("programTitleFocusedColor") as number;
        const programMargin = (this.getValueJS("programHorizMargin") as number) ?? 14;
        const showPast = (this.getValueJS("showPastTimeScreen") as boolean) ?? true;
        const pastBlend = (this.getValueJS("pastTimeScreenBlendColor") as number) >>> 0;
        const pastBmp = this.getBitmap("pastTimeScreenBitmapUri");
        const programBgBmp = this.getBitmap("programBackgroundBitmapUri");
        const noDataText = (this.getValueJS("channelNoDataText") as string) ?? "";
        const sepWidth = isFHD ? 2 : 1;
        const vGap = isFHD ? 3 : 2; // thin gap between rows so cells read as separate
        const cellH = rowHeight - vGap;
        const nowX = this.gridX + (now - this.viewStartTime) * secToPx;
        let y = gridTop;
        for (let r = 0; r < visible; r++) {
            const ch = topCh + r;
            if (ch >= this.channels.length) {
                break;
            }
            // Past-time screen: a dim base layer behind the programs airing before "now". Drawn
            // first so program cells (and the focus highlight) render on top of it.
            if (showPast && nowX > this.gridX) {
                const pastWidth = Math.min(nowX, this.gridX + this.gridWidth) - this.gridX;
                const pastRect = { x: this.gridX, y, width: pastWidth, height: cellH };
                if (pastBmp) {
                    this.drawImage(pastBmp, { ...pastRect }, 0, opacity, draw2D, pastBlend);
                } else {
                    // Default white blend means "no tint" — draw a subtle dim overlay instead.
                    const tint = pastBlend === 0xffffffff ? 0x00000059 : pastBlend;
                    draw2D?.doDrawRotatedRect(pastRect, tint, rotation, center, opacity);
                }
            }

            this.renderChannelInfo(
                ch,
                { x: infoX, y, width: infoWidth, height: rowHeight },
                opacity,
                nodeFocus,
                draw2D,
                textIndex++
            );

            const progs = this.programs[ch] ?? [];
            const focusedProgram = this.programIndexByChannel[ch] ?? 0;
            // Start at the first program touching the visible window (binary search) instead of
            // scanning every off-screen program each frame; include the focused cell so its
            // highlight always draws even if it starts just before the left edge.
            let startP = this.programIndexAtTime(ch, this.viewStartTime);
            if (ch === this.channelIndex) {
                startP = Math.min(startP, focusedProgram);
            }
            startP = Math.max(0, startP);
            for (let p = startP; p < progs.length; p++) {
                const pStart = this.programStart[ch][p];
                const pDuration = this.programDuration[ch][p];
                const cellX = this.gridX + (pStart - this.viewStartTime) * secToPx;
                const cellW = pDuration * secToPx;
                if (cellX + cellW <= this.gridX) {
                    continue;
                }
                if (cellX >= this.gridX + this.gridWidth) {
                    break;
                }
                const clipX = Math.max(cellX, this.gridX);
                const clipW = Math.min(cellX + cellW, this.gridX + this.gridWidth) - clipX;
                const cellRect = { x: clipX, y, width: clipW, height: cellH };
                const focused = ch === this.channelIndex && p === focusedProgram && !this.inChannelInfoColumn;
                const isGap = this.gapFlags[ch][p];
                const isPast = pStart + pDuration <= now;

                // Cell background. The focused cell (when the grid has focus) gets Roku's
                // solid highlight; others get a faint panel + a thin trailing divider.
                if (focused && nodeFocus) {
                    draw2D?.doDrawRotatedRect(cellRect, 0xffffffff, rotation, center, opacity);
                } else if (programBgBmp) {
                    this.drawImage(programBgBmp, { ...cellRect }, 0, opacity, draw2D);
                } else {
                    draw2D?.doDrawRotatedRect(cellRect, 0xffffff0f, rotation, center, opacity);
                    draw2D?.doDrawRotatedRect(
                        { x: cellRect.x + cellRect.width - sepWidth, y, width: sepWidth, height: cellH },
                        0x00000066,
                        rotation,
                        center,
                        opacity
                    );
                }

                // Text color: dark on the focused highlight, dimmed for past programs.
                let titleColor: number;
                if (focused && nodeFocus) {
                    titleColor = isGap ? 0x707070ff : programFocusColor;
                } else if (isGap || isPast) {
                    titleColor = 0x9aa0a6ff;
                } else {
                    titleColor = programColor;
                }
                const title = isGap ? noDataText : (progs[p].getValueJS("TITLE") as string) ?? "";
                const textRect = { x: clipX + programMargin, y, width: clipW - 2 * programMargin, height: cellH };
                if (textRect.width > 4) {
                    this.drawText(
                        title,
                        programFont,
                        titleColor,
                        opacity,
                        textRect,
                        "left",
                        "center",
                        0,
                        draw2D,
                        "...",
                        textIndex++
                    );
                }

                // When the grid does not hold focus, mark the focused program with a footprint
                // outline (drawn on top, so it frames the text without hiding it).
                if (focused && !nodeFocus) {
                    this.renderFocus(cellRect, opacity, nodeFocus, draw2D);
                }
            }
            y += rowHeight;
        }

        // --- Now bar ---
        const nowBarOffset = (this.getValueJS("nowBarOffset") as number) ?? 0;
        const nowBarX = nowX + nowBarOffset;
        if (nowBarX >= this.gridX && nowBarX <= this.gridX + this.gridWidth) {
            const nowBarWidth = (this.getValueJS("nowBarWidth") as number) || (isFHD ? 3 : 2);
            const nowBarHeight = (this.getValueJS("nowBarHeight") as number) || visible * rowHeight;
            const nowRect = { x: nowBarX, y: gridTop, width: nowBarWidth, height: nowBarHeight };
            const nowBarBmp = this.getBitmap("nowBarBitmapUri");
            if (nowBarBmp) {
                this.drawImage(
                    nowBarBmp,
                    { ...nowRect },
                    0,
                    opacity,
                    draw2D,
                    this.getValueJS("nowBarBlendColor") as number
                );
            } else {
                // Subtle light marker rather than a glaring solid bar.
                draw2D?.doDrawRotatedRect(nowRect, 0xebebebcc, rotation, center, opacity);
            }
        }

        // --- Overlay ---
        const overlayBmp = this.getBitmap("overlayBitmapUri");
        if (overlayBmp) {
            const overlayHeight = (this.getValueJS("overlayHeight") as number) || overlayBmp.height;
            this.drawImage(
                overlayBmp,
                { x: rect.x, y: rect.y + totalH - overlayHeight, width: totalW, height: overlayHeight },
                0,
                opacity,
                draw2D
            );
        }

        if (this.shouldShowLoading()) {
            this.renderLoading(
                { x: this.gridX, y: gridTop, width: this.gridWidth, height: gridAreaH },
                opacity,
                draw2D
            );
        }
    }

    protected renderChannelInfo(
        ch: number,
        infoRect: Rect,
        opacity: number,
        nodeFocus: boolean,
        draw2D: IfDraw2D | undefined,
        textIndex: number
    ) {
        const channel = this.channels[ch];
        const backgroundBmp = this.getBitmap("channelInfoBackgroundBitmapUri");
        if (backgroundBmp) {
            this.drawImage(backgroundBmp, { ...infoRect }, 0, opacity, draw2D);
        }
        const iconUri = channel.getValueJS("HDSMALLICONURL") as string;
        const icon = iconUri ? this.loadBitmap(iconUri) : undefined;
        const align = ((this.getValueJS("channelInfoAlignment") as string) || "left").toLowerCase();
        if (icon?.isValid()) {
            const pad = this.resolution === "FHD" ? 12 : 8;
            const iconHeight = infoRect.height - 2 * pad;
            const iconWidth = icon.height > 0 ? icon.width * (iconHeight / icon.height) : iconHeight;
            const iconX = infoRect.x + (infoRect.width - iconWidth) / 2;
            this.drawImage(
                icon,
                { x: iconX, y: infoRect.y + pad, width: iconWidth, height: iconHeight },
                0,
                opacity,
                draw2D
            );
        } else {
            const title = (channel.getValueJS("TITLE") as string) ?? "";
            const font = this.getValue("channelInfoFont") as Font;
            const color = this.getValueJS("channelInfoTextColor") as number;
            const pad = this.resolution === "FHD" ? 20 : 14;
            const textRect = {
                x: infoRect.x + pad,
                y: infoRect.y,
                width: infoRect.width - 2 * pad,
                height: infoRect.height,
            };
            this.drawText(
                title,
                font,
                color,
                opacity,
                textRect,
                align === "right" ? "right" : "left",
                "center",
                0,
                draw2D,
                "...",
                textIndex
            );
        }
        if (this.inChannelInfoColumn && ch === this.channelIndex) {
            this.renderFocus(infoRect, opacity, nodeFocus, draw2D);
        }
    }

    protected shouldShowLoading(): boolean {
        const auto = (this.getValueJS("automaticLoadingDataFeedback") as boolean) ?? true;
        const show = (this.getValueJS("showLoadingDataFeedback") as boolean) ?? false;
        if (this.channels.length === 0) {
            return auto || show;
        }
        return !auto && show;
    }

    protected renderLoading(rect: Rect, opacity: number, draw2D?: IfDraw2D) {
        const text = (this.getValueJS("loadingDataText") as string) || "Loading Data…";
        const font = this.getValue("programTitleFont") as Font;
        const color = this.getValueJS("programTitleColor") as number;
        this.drawText(text, font, color, opacity, rect, "center", "center", 0, draw2D, "...", 99999);
    }

    /** Formats an epoch (seconds) as a 12-hour clock label, e.g. "8:30 pm". */
    protected formatClock(epoch: number): string {
        const date = new Date(epoch * 1000);
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? "pm" : "am";
        hours %= 12;
        if (hours === 0) {
            hours = 12;
        }
        const mm = minutes < 10 ? `0${minutes}` : `${minutes}`;
        return `${hours}:${mm} ${ampm}`;
    }

    /** Returns a short "Mon DD" date label for an epoch (seconds). */
    protected monthDayLabel(epoch: number): string {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const date = new Date(epoch * 1000);
        return `${months[date.getMonth()] ?? ""} ${date.getDate()}`;
    }

    /** Returns the weekday name for an epoch (seconds), used as the default column header. */
    protected dayLabel(epoch: number): string {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return days[new Date(epoch * 1000).getDay()] ?? "";
    }
}
