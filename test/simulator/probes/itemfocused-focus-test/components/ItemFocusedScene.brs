' Categories-screen probe (see ItemFocusedScene.xml header for the full experiment).
'
' Left category list drives the right grid's content. Focus starts on the list; the grid
' logs every itemFocused firing together with its isInFocusChain() state, so we can see on
' a real device whether itemFocused fires while the grid is unfocused (content load) or only
' once focus moves onto it.

sub init()
    m.log = m.top.findNode("log")
    m.lines = []

    m.categories = m.top.findNode("categories")
    m.grid = m.top.findNode("grid")

    ' Build the left category list.
    catData = createObject("roSGNode", "ContentNode")
    for i = 1 to 6
        entry = catData.createChild("ContentNode")
        entry.title = "Category " + i.toStr()
    end for
    m.categories.content = catData

    ' Observe BEFORE the first content load so we capture the very first firing.
    ' - categories.itemFocused: changes as the user moves UP/DOWN in the (focused) list;
    '   we use it to load the matching item set's content into the grid.
    ' - grid.itemFocused: the field under investigation.
    m.categories.observeField("itemFocused", "onCategoryFocused")
    m.grid.observeField("itemFocused", "onGridItemFocused")

    ' Focus the category list; loading grid content below happens while the grid is unfocused.
    m.categories.setFocus(true)
    logLine("init: focus on category list. Loading category 1 content into the grid...")

    ' Load the first category's content immediately (the list starts focused on index 0).
    loadCategory(0)
    logLine("--- Load done. UP/DOWN changes category; RIGHT enters grid; LEFT at grid's left edge returns. ---")
end sub

' Fires when the focused category changes (user navigates the left list). A master/detail
' screen loads the focused item's content into the right grid on each focus change.
sub onCategoryFocused()
    idx = m.categories.itemFocused
    logLine(">>> category itemFocused=" + idx.toStr() + " -> loading its content into the grid")
    loadCategory(idx)
end sub

' The field under investigation: does this fire while focus is still on the category list?
sub onGridItemFocused()
    logLine("*** grid itemFocused=" + m.grid.itemFocused.toStr() + " inFocusChain=" + boolStr(m.grid.isInFocusChain()))
end sub

' Assigns a fresh, already-populated content node to the grid for the given item-set index,
' then writes jumpToItem=0 the way a master/detail app commonly does: a "jump to remembered
' index" field defaults to 0, so a `>= 0` guard writes jumpToItem = 0 on every content load.
' This is the suspected real trigger: does writing jumpToItem fire itemFocused while the grid
' is NOT focused?
sub loadCategory(catIndex as integer)
    content = createObject("roSGNode", "ContentNode")
    for i = 1 to 8
        item = content.createChild("ContentNode")
        item.title = "C" + (catIndex + 1).toStr() + "-" + i.toStr()
    end for
    m.grid.content = content

    ' Unconditionally jump to item 0 right after loading content, while the grid is still
    ' unfocused. Watch whether a "*** grid itemFocused=0 inFocusChain=false" line appears as a
    ' result of this write.
    logLine("    (writing grid.jumpToItem = 0 on every content load)")
    m.grid.jumpToItem = 0
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    ' RIGHT from the category list enters the grid. The vertical LabelList does not consume
    ' left/right, so the press bubbles up here while the list is focused.
    if key = "right" and m.categories.isInFocusChain()
        m.grid.setFocus(true)
        logLine(">>> focus moved to GRID (press LEFT at the grid's left edge to return)")
        return true
    end if

    ' LEFT at the grid's left edge returns focus to the category list. The grid consumes LEFT
    ' for column navigation, but at the left column it leaves the press unhandled, so it bubbles
    ' up here. Derive the column from the flat itemFocused index and numColumns (both plain
    ' integers) rather than reading focusColumn, which is not a scalar integer on a real device.
    if key = "left" and m.grid.isInFocusChain()
        numCols = m.grid.numColumns
        if numCols < 1 then numCols = 1
        if (m.grid.itemFocused mod numCols) = 0
            m.categories.setFocus(true)
            logLine(">>> focus returned to CATEGORY LIST")
            return true
        end if
    end if

    return false
end function

sub logLine(text as string)
    print text
    m.lines.push(text)
    ' Keep only the last ~18 lines so the on-screen log stays readable.
    if m.lines.count() > 18
        m.lines.delete(0)
    end if
    joined = ""
    for each ln in m.lines
        joined = joined + ln + Chr(10)
    end for
    m.log.text = joined
end sub

function boolStr(b as boolean) as string
    if b then return "true"
    return "false"
end function
