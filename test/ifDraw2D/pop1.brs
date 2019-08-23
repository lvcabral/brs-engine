Library "v30/bslDefender.brs"

Function Main() as void
    m.screen = CreateObject("roScreen", true, 854, 480)
    m.port = CreateObject("roMessagePort")
    m.compositor = CreateObject("roCompositor")
    m.clock = CreateObject("roTimespan")
    m.code = bslUniversalControlEventCodes()
    m.const = GetConstants()
    ' Read assets
    m.scale = 1
    m.levelId = 1
    m.page = 1
    m.kid = GetKid()
    spriteSet = m.kid.sprites[m.kid.face] 
    m.compositor.SetDrawTo(m.screen, &h000000FF)
    m.clock.Mark()
    m.screen.SetMessagePort(m.port)
    m.screen.SetAlphaEnable(true)
    if m.kid.face = m.const.FACE_LEFT
        baseX = 1250
    else
        baseX = 30
    end if
    baseY = 120
    sprite = m.compositor.NewAnimatedSprite(baseX, baseY - spriteSet.animations.stand.frames[0].GetHeight(), spriteSet.animations.stand.frames, 20)
    offsets = spriteSet.animations.stand.offsets
    speed = 100
    counter = 0
    frame = 0
    pressed = false
    stopped = true

    button = m.code.BUTTON_RIGHT_PRESSED
    while true
        event = m.port.GetMessage()
        if (type(event) = "roUniversalControlEvent")
            id = event.GetInt()            
            if (m.kid.face = m.const.FACE_LEFT and id = m.code.BUTTON_LEFT_PRESSED) or (m.kid.face = m.const.FACE_RIGHT and id = m.code.BUTTON_RIGHT_PRESSED) 
                'print "counter=",counter
                if stopped
                    stopped = false
                    sprite.Remove()
                    sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.startrun.frames,20)
                    counter = spriteSet.animations.startrun.frames.count()
                    frame = 0
                    offsets = spriteSet.animations.startrun.offsets
                    nextSprite = spriteSet.animations.running
                    'print "next=running"
                    pressed = true
                end if
            else if (m.kid.face = m.const.FACE_LEFT and id = m.code.BUTTON_LEFT_RELEASED) or (m.kid.face = m.const.FACE_RIGHT and id = m.code.BUTTON_RIGHT_RELEASED)
                if not stopped
                    sprite.Remove()
                    sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.runstop.frames,20)
                    counter = spriteSet.animations.runstop.frames.count()
                    frame = 0
                    offsets = spriteSet.animations.runstop.offsets
                    stopped = true
                    nextSprite = invalid
                    'print "next=stand"
                    pressed = false
                end if
            else if (m.kid.face = m.const.FACE_LEFT and id = m.code.BUTTON_RIGHT_PRESSED) or (m.kid.face = m.const.FACE_RIGHT and id = m.code.BUTTON_LEFT_PRESSED) 
                m.kid.face = Abs(m.kid.face-1)
                spriteSet = m.kid.sprites[m.kid.face]
                sprite.Remove()
                sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.turn.frames,20)
                counter = spriteSet.animations.turn.frames.count()
                frame = 0
                offsets = spriteSet.animations.turn.offsets
                nextSprite = spriteSet.animations.stand
                'print "turn->stand"
                pressed = true
            else if (id = m.code.BUTTON_LEFT_RELEASED) or (id = m.code.BUTTON_RIGHT_RELEASED)
                pressed = false
            else if (id = m.code.BUTTON_UP_PRESSED)
                if stopped
                    sprite.Remove()
                    sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.highjump.frames,20)
                    counter = spriteSet.animations.highjump.frames.count()
                    frame = 0
                    offsets = spriteSet.animations.highjump.offsets
                    nextSprite = spriteSet.animations.hangdrop
                    pressed = true
                end if
            else if (id = m.code.BUTTON_UP_RELEASED)
                    pressed = false
            else if (id = m.code.BUTTON_DOWN_PRESSED)
                if stopped
                    sprite.Remove()
                    sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.stoop.frames,20)
                    counter = spriteSet.animations.stoop.frames.count()
                    frame = 0
                    offsets = spriteSet.animations.stoop.offsets
                    nextSprite = spriteSet.animations.crouch
                    pressed = true
                end if
            else if (id = m.code.BUTTON_DOWN_RELEASED)
                if stopped
                    sprite.Remove()
                    sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.standup.frames,20)
                    counter = spriteSet.animations.standup.frames.count()
                    frame = 0
                    offsets = spriteSet.animations.standup.offsets
                    nextSprite = invalid
                    pressed = false
                end if
            endif            
        else if (event = invalid)
            ticks = m.clock.TotalMilliseconds()
            if (ticks > speed)
                'apply offset
                if m.kid.face = m.const.FACE_LEFT
                    x = sprite.GetX() - offsets[frame].x
                else
                    x = sprite.GetX() + offsets[frame].x
                end if
                y = baseY - sprite.GetRegion().GetHeight() + offsets[frame].y
                basey = baseY + offsets[frame].y
                if offsets[frame].y <> 0
                    print "frame="; frame
                    print "offset y=";offsets[frame].y
                end if
                if x < 30
                    x = 1250
                else if x > 1250
                    x = 30
                end if
                if counter = 1
                    if nextSprite <> invalid 
                        sprite.Remove()
                        sprite = m.compositor.NewAnimatedSprite(x, y, nextSprite.frames,20)
                        counter = nextSprite.frames.count()
                        frame = 0
                        offsets = nextSprite.offsets
                        nextSprite = invalid
                        yoff = 0
                        print "switched!"
                    else if not pressed
                        sprite.Remove()
                        sprite = m.compositor.NewAnimatedSprite(x, y, spriteSet.animations.stand.frames,20)
                        frame = 0
                        offsets = spriteSet.animations.stand.offsets
                        yoff = 0
                        print "stand!"
                    end if
                end if
                m.kid.x = x
                m.kid.y = y
                m.kid.update()
                sprite.MoveTo( m.kid.x, m.kid.y )
                m.compositor.AnimationTick(ticks)
                m.compositor.DrawAll()
                m.screen.SwapBuffers()
                m.clock.Mark()
                if counter > 0
                    counter = counter - 1
                end if
                'increment frame counter
                if frame < offsets.count()-1
                    frame = frame + 1
                else
                    frame = 0
                end if
            endif
        endif
    end while
End Function

Function GetKid() as object
    const = GetConstants()
    path = "pkg:/assets/sprites/" 
    
    kid = {}
    'properties
    kid.sprites = [{}, {}]
    kid.sprites[const.FACE_LEFT].regions = LoadBitmapRegions(path, "kid", "kid-l", 0)
    kid.sprites[const.FACE_LEFT].animations = LoadSpriteAnimations("kid", kid.sprites[const.FACE_LEFT].regions)
    kid.sprites[const.FACE_RIGHT].regions = LoadBitmapRegions(path, "kid", "kid-r", 123)
    kid.sprites[const.FACE_RIGHT].animations = LoadSpriteAnimations("kid", kid.sprites[const.FACE_RIGHT].regions)
    kid.face = const.FACE_RIGHT
    kid.action = "stand"
    kid.blockX = 0
    kid.blockY = 0
    kid.x = 0
    kid.y = 0
    
    'methods
    kid.update = update_kid
    
    return kid
End Function

Function update_kid()
    'print "face ="; m.face; " x ="; m.x; "y ="; m.y
End Function

Function GetConstants() as object
    const = {}
    const.SCALE_FACTOR = 1

    const.SCREEN_WIDTH = 320
    const.SCREEN_HEIGHT = 200

    const.WORLD_WIDTH = const.SCREEN_WIDTH * const.SCALE_FACTOR
    const.WORLD_HEIGHT = const.SCREEN_HEIGHT * const.SCALE_FACTOR

    const.FACE_LEFT = 0
    const.FACE_RIGHT = 1
    
    const.BLOCK_WIDTH = 32
    const.BLOCK_HEIGHT = 63

    const.ROOM_HEIGHT = const.BLOCK_HEIGHT * 3
    const.ROOM_WIDTH = const.SCREEN_WIDTH

    const.TYPE_DUNGEON = 0
    const.TYPE_PALACE = 1

    const.TILE_SPACE = 0
    const.TILE_FLOOR = 1
    const.TILE_SPIKES = 2
    const.TILE_PILLAR = 3
    const.TILE_GATE = 4
    const.TILE_STUCK_BUTTON = 5
    const.TILE_DROP_BUTTON = 6
    const.TILE_TAPESTRY = 7
    const.TILE_BOTTOM_BIG_PILLAR = 8
    const.TILE_TOP_BIG_PILLAR = 9
    const.TILE_POTION = 10
    const.TILE_LOOSE_BOARD = 11
    const.TILE_TAPESTRY_TOP = 12
    const.TILE_MIRROR = 13
    const.TILE_DEBRIS = 14
    const.TILE_RAISE_BUTTON = 15
    const.TILE_EXIT_LEFT = 16
    const.TILE_EXIT_RIGHT = 17
    const.TILE_CHOPPER = 18
    const.TILE_TORCH = 19
    const.TILE_WALL = 20
    const.TILE_SKELETON = 21
    const.TILE_SWORD = 22
    const.TILE_BALCONY_LEFT = 23
    const.TILE_BALCONY_RIGHT = 24
    const.TILE_LATTICE_PILLAR = 25
    const.TILE_LATTICE_SUPPORT = 26
    const.TILE_SMALL_LATTICE = 27
    const.TILE_LATTICE_LEFT = 28
    const.TILE_LATTICE_RIGHT = 29
    const.TILE_TORCH_WITH_DEBRIS = 30
    const.TILE_NULL = 31
    return const
End Function

Function LoadBitmapRegions(path as string, jsonFile as string, pngFile = "" as string, invertOffset = 0 as integer) as object
    if pngFile = ""
        pngFile = jsonFile
    end if
    json = ParseJson(ReadAsciiFile(path + jsonFile + ".json"))
    regions = {}
    if json <> invalid
        bitmap=CreateObject("robitmap", path + pngFile + ".png")
            
        for each name in json.frames
            frame = json.frames.lookup(name).frame
            if invertOffset = 0
                regions.AddReplace(name, CreateObject("roRegion",bitmap,frame.x,frame.y,frame.w,frame.h))
            else
                regions.AddReplace(name, CreateObject("roRegion",bitmap,(invertOffset-frame.w-frame.x),frame.y,frame.w,frame.h))
            end if
        next
    end if
    return regions
End Function

Function LoadSpriteAnimations(sprite as string, regions as object) as object
    'Read animations
    path = "pkg:/assets/anims/" 
    json = ParseJson(ReadAsciiFile(path + sprite + "-sequence.json"))
    animations = {}
    if json <> invalid
        for each frameset in json.animation.sequence
            name = lcase(frameset.name)
            frameArray = []
            offsetArray = []
            if name = "startrun" or name = "running" or name="stand" or name = "runstop" or name = "highjump" or name = "hangdrop" or name = "standup" or name = "stoop" or name = "crouch" or name = "turn"
                for each frame in frameset.frames.frame
                    if frame.type = "SPRITE"
                        frameArray.Push(regions.lookup(lcase(frame.value)))
                        xOffset = 0
                        yOffset = 0
                        if frame.DoesExist("xOffSet")
                            xOffset = val(frame.xOffSet)
                        end if
                        if frame.DoesExist("yOffSet")
                            yOffset = val(frame.yOffSet)
                        end if
                        offsetArray.Push({x: xOffset, y:yOffset})
                    end if
                next   
                animations.AddReplace(name,{frames: frameArray, offsets: offsetArray})
            end if 
        next
    else
        print "invalid json"
    end if
'    json = ParseJson(ReadAsciiFile(path + sprite + ".json"))
'    animations = {}
'    if json <> invalid
'        for each name in json.sequence
'            if name = "startrun" or name = "running" or name="stand" or name = "runstop" or name = "highjump" or name = "hangdrop" or name = "standup" or name = "stoop" or name = "crouch" or name = "turn"
'                frames = json.sequence.lookup(name)
'                frameArray = []
'                offsetArray = []
'                index = 0
'                for each frame in frames
'                    if frame.cmd = 0 and isint(frame.p1)
'                        frameArray.Push(regions.lookup(sprite + "-" + itostr(frame.p1)))
'                        offsetArray.Push({x: 0, y:0})
'                        index = index + 1
'                    else if frame.cmd = 251 and index > 0 'offset X
'                        offsetArray[index-1].x = frame.p1
'                    else if frame.cmd = 250 and index > 0 'offset Y
'                        offsetArray[index-1].y = frame.p1
'                    end if
'                next   
'                animations.AddReplace(name,{frames: frameArray, offsets: offsetArray})
'            end if 
'        next
'    else
'        print "invalid json"
'    end if
    return animations
End Function

Function GenerateFrameNames(prefix as string, start as integer, finish as integer, suffix = "" as string, shuffle = false as boolean) as Object
    frameNames = []
    if shuffle
        length = finish-start+1
        frame = rnd(length)-1
        for f = 1 to length
            frameNames.Push(prefix + itostr(frame+start) + suffix)
            frame = (frame + 1) mod length
        next
    else
        For f = start to finish
            frameNames.Push(prefix + itostr(f) + suffix)
        Next
    end if
    return frameNames
End Function

Function ConvertXtoBlockX( x ) 

    return Int( ( x - 7 ) / 14 )
    
End Function

Function ConvertYtoBlockY( y )

    return Int( y / m.const.BLOCK_HEIGHT )
    
End Function

Function ConvertBlockXtoX( blockX )

    return blockX * 14 + 7
    
End Function

Function convertBlockYtoY( blockY )

    return ( blockY + 1 ) * m.const.BLOCK_HEIGHT - 10
    
End Function
'******************************************************
'**  Roku - General Utils
'******************************************************

'******************************************************
' Validate parameter is the correct type
'******************************************************

Function validateParam(param As Object, paramType As String,functionName As String, allowInvalid = false) As Boolean
    if paramType = "roString" or paramType = "String" then
        if type(param) = "roString" or type(param) = "String" then
            return true
        end if
    else if type(param) = paramType then
        return true
    endif

    if allowInvalid = true then
        if type(param) = invalid then
            return true
        endif
    endif

    print "invalid parameter of type "; type(param); " for "; paramType; " in function "; functionName
    return false
End Function

'******************************************************
' Registry Helpers
'******************************************************

Function RegRead(key, section=invalid)
    if section = invalid then section = "Default"
    sec = CreateObject("roRegistrySection", section)
    if sec.Exists(key) then return sec.Read(key)
    return invalid
End Function

Function RegWrite(key, val, section=invalid)
    if section = invalid then section = "Default"
    sec = CreateObject("roRegistrySection", section)
    sec.Write(key, val)
    sec.Flush() 'commit it
End Function

Function RegDelete(key, section=invalid)
    if section = invalid then section = "Default"
    sec = CreateObject("roRegistrySection", section)
    sec.Delete(key)
    sec.Flush()
End Function

Function RegUserRead(key)
    userValue = RegRead(key, getGlobalVar("user").Id)

    return userValue
End Function

Function RegUserWrite(key, val)
    RegWrite(key, tostr(val), getGlobalVar("user").Id)
End Function

'******************************************************
' Registry Array To String
'******************************************************

Function RegistryArrayToString(array As Object) As String
    str = ""
    for each key in array
        if key <> invalid
            str = tostr(key) + ":" + tostr(array[key]) + "|" + str
        end if
    end for

    return str
End Function

'******************************************************
' Registry String To Array
'******************************************************

Function RegistryStringToArray(str As String) As Object
    aa = CreateObject("roAssociativeArray")
    list = str.tokenize("|") 'strTokenize(str, "|")

    for each e in list
        element = e.tokenize(":")
        aa.AddReplace(element[0], element[1])
    end for

    return aa
End Function

'******************************************************
' Source: Plex Roku Client
'         https://github.com/plexinc/roku-client-public
' Return the first valid argument
'******************************************************

Function firstOf(first, second, third=invalid, fourth=invalid)
    if first <> invalid then return first
    if second <> invalid then return second
    if third <> invalid then return third
    return fourth
End Function

'******************************************************
' Format a Date Stamp
'******************************************************

Function formatDateStamp(dateStamp As String)
    dateOnly = left(dateStamp, 10)

    '2013-05-08T17:55:33.5408293Z
    return dateOnly
End Function

'******************************************************
' Get a " char as a string
'******************************************************

Function Quote()
    q$ = Chr(34)
    return q$
End Function

'******************************************************
' Pluralize simple strings like "1 minute" or "2 minutes"
'******************************************************

Function Pluralize(val As Integer, str As String) As String
    ret = itostr(val) + " " + str
    if val <> 1 ret = ret + "s"
    return ret
End Function

'******************************************************
' Truncate a String To the desired length
'******************************************************

Function Truncate(words As String, length As Integer, ellipsis As Boolean) as String
    truncated = ""

    If words.Len() > length
        truncated = left(words, length)

        If ellipsis
            truncated = truncated + ".."
        End If
    Else
        truncated = words
    End If

    Return truncated
End Function

'******************************************************
' Convert int to string. This is necessary because
' the builtin Stri(x) prepends whitespace
'******************************************************

Function itostr(i As Integer) As String
    str = Stri(i)
    return strTrim(str)
End Function

'******************************************************
' Trim a string
'******************************************************

Function strTrim(str As String) As String
    st = CreateObject("roString")
    st.SetString(str)
    return st.Trim()
End Function

'******************************************************
' CurrentTimeAsString
'******************************************************

Function CurrentTimeAsString(localized=true As Boolean) As String

    time = CreateObject("roDateTime")

    return GetTimeString(time, localized)
    
End Function

Function GetTimeString(time as Object, localized=true As Boolean) As String

    timeFormat = firstOf(RegRead("prefTimeFormat"), "12h")

    if localized then
        time.ToLocalTime()
    end if

    hours = time.GetHours()
    if timeFormat = "24h" then
        suffix = ""
    else if hours >= 12 then
        hours = hours - 12
        suffix = " pm"
        if hours = 0 then hours = 12
    else
        suffix = " am"
        if hours = 0 then hours = 12
    end if
    timeStr = tostr(hours) + ":"

    minutes = time.GetMinutes()
    if minutes < 10 then
        timeStr = timeStr + "0"
    end if
    return timeStr + tostr(minutes) + suffix
End Function

'**********************************************************
'** Zero Pad Text
'**********************************************************

Function ZeroPad(text As String, length = invalid) As String
    if length = invalid then length = 2

    If text.Len() < length
        For i = 1 to length-text.Len()
            text = "0" + text
        End For
    End If
    
    Return text
End Function

'**********************************************************
'** Debug (eventually Write to Log file)
'**********************************************************

Sub Debug(message As String)
    print message

End Sub

'**********************************************************
'** Get Image Sizes Based Off Screen Type
'**********************************************************

Function GetImageSizes(screenType)

    '*** Grid ***
    if screenType = "two-row-flat-landscape-custom"
        hdWidth  = 266
        hdHeight = 150
        sdWidth  = 138
        sdHeight = 77

    else if screenType = "flat-movie"
        hdWidth  = 210
        hdHeight = 270
        sdWidth  = 110
        sdHeight = 150

    else if screenType = "flat-square"
        hdWidth  = 132
        hdHeight = 132
        sdWidth  = 96
        sdHeight = 86

    else if screenType = "mixed-aspect-ratio-portrait"
        hdWidth  = 192
        hdHeight = 274
        sdWidth  = 140
        sdHeight = 180

    else if screenType = "mixed-aspect-ratio-landscape"
        hdWidth  = 192
        hdHeight = 144
        sdWidth  = 140
        sdHeight = 94

    else if screenType = "mixed-aspect-ratio-square"
        hdWidth  = 192
        hdHeight = 192
        sdWidth  = 140
        sdHeight = 126

    '*** Poster ****
    else if screenType = "flat-episodic-16x9"
        hdWidth  = 250
        hdHeight = 141
        sdWidth  = 185
        sdHeight = 94

    else if screenType = "arced-square"
        hdWidth  = 300
        hdHeight = 300
        sdWidth  = 223
        sdHeight = 200

    else if screenType = "flat-category"
        hdWidth  = 304
        hdHeight = 237
        sdWidth  = 224
        sdHeight = 158

    '*** List ***
    else if screenType = "list"
        hdWidth  = 250
        hdHeight = 250
        sdWidth  = 136
        sdHeight = 124

    '*** Springboard ***
    else if screenType = "movie"
        hdWidth  = 148
        hdHeight = 212
        sdWidth  = 112
        sdHeight = 142

    else if screenType = "rounded-rect-16x9-generic"
        hdWidth  = 269
        hdHeight = 152
        sdWidth  = 177
        sdHeight = 90

    else if screenType = "rounded-square-generic"
        hdWidth  = 209
        hdHeight = 209
        sdWidth  = 143
        sdHeight = 129

    else if screenType = "arced-portrait"
        hdWidth  = 214
        hdHeight = 306
        sdWidth  = 158
        sdHeight = 204

    else
        ' default flat movie
        hdWidth  = 210
        hdHeight = 270
        sdWidth  = 110
        sdHeight = 150

    end if

    sizes = CreateObject("roAssociativeArray")
    sizes.hdWidth  = hdWidth
    sizes.hdHeight = hdHeight
    sizes.sdWidth  = sdWidth
    sizes.sdHeight = sdHeight

    return sizes
End Function

'******************************************************
'** Build an Image URL
'******************************************************

Function BuildImage(url, width = invalid, height = invalid, tag = "", watched = false As Boolean, percentage = 0 As Integer, unplayed = 0 As Integer)   

    query = ""

    ' Use Enhanced Images
    if RegRead("prefEnhancedImages") <> "no"
        query = query + "?EnableImageEnhancers=true&format=jpg&BackgroundColor=" + HttpEncode(getGlobalVar("backgroundColor"))
    else
        query = query + "?EnableImageEnhancers=false"
    end if

    ' Check for cache tag
    if tag <> ""
        ' Clean Tag
        tag = HttpEncode(tag)
        query = query + "&tag=" + tag
    end if

    ' Use Media Indicators
    if RegRead("prefMediaIndicators") = "yes" Or RegRead("prefMediaIndicators") = invalid
        if watched
            query = query + "&AddPlayedIndicator=true"
        end if

        if percentage <> 0
            query = query + "&PercentPlayed=" + itostr(percentage)
        end if

        if unplayed <> 0
            query = query + "&UnplayedCount=" + itostr(unplayed)
        end if
    end if

    if width <> invalid then
        query = query + "&width=" + itostr(width)
    end if
    
    if height <> invalid then
        query = query + "&height=" + itostr(height)
    end if
    
    return url + query
    
End Function

'******************************************************
'** Is a number
'******************************************************

Function isNumeric(obj As Dynamic) As Boolean
    if obj = invalid return false
    if isInt(obj)    return true
    if isFloat(obj)  return true
    if isDouble(obj) return true

    return false
End Function

'******************************************************
'** Is object an Integer
'******************************************************

Function isint(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifInt") = invalid return false
    return true
End Function

Function validint(obj As Dynamic) As Integer
    if obj <> invalid and GetInterface(obj, "ifInt") <> invalid then
        return obj
    else
        return 0
    end if
End Function

'******************************************************
'** Is object a Float
'******************************************************

Function isFloat(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifFloat") = invalid return false
    return true
End Function

'******************************************************
'** Is object a Double
'******************************************************

Function isDouble(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifDouble") = invalid return false
    return true
End Function

Sub SwapArray(arr, i, j, setOrigIndex=false)
    if i <> j then
        if setOrigIndex then
            if arr[i].OrigIndex = invalid then arr[i].OrigIndex = i
            if arr[j].OrigIndex = invalid then arr[j].OrigIndex = j
        end if

        temp = arr[i]
        arr[i] = arr[j]
        arr[j] = temp
    end if
End Sub

Function ShuffleArray(arr, focusedIndex)
    ' Start by moving the current focused item to the front.
    SwapArray(arr, 0, focusedIndex, true)

    ' Now loop from the end to 1. Rnd doesn't return 0, so the item we just put
    ' up front won't be touched.
    for i = arr.Count() - 1 to 1 step -1
        SwapArray(arr, i, Rnd(i), true)
    next

    return 0
End Function

Function UnshuffleArray(arr, focusedIndex)
    item = arr[focusedIndex]

    i = 0
    while i < arr.Count()
        if arr[i].OrigIndex = invalid then return 0
        SwapArray(arr, i, arr[i].OrigIndex)
        if i = arr[i].OrigIndex then i = i + 1
    end while

    return firstOf(item.OrigIndex, 0)
End Function

'**********************************************************
'**  Video Player Example Application - General Utilities 
'**  November 2009
'**  Copyright (c) 2009 Roku Inc. All Rights Reserved.
'**********************************************************


'******************************************************
'Insertion Sort
'Will sort an array directly, or use a key function
'******************************************************
Sub Sort(A as Object, key=invalid as dynamic)

    if type(A)<>"roArray" then return

    if (key=invalid) then
        for i = 1 to A.Count()-1
            value = A[i]
            j = i-1
            while j>= 0 and A[j] > value
                A[j + 1] = A[j]
                j = j-1
            end while
            A[j+1] = value
        next

    else
        if type(key)<>"Function" then return
        for i = 1 to A.Count()-1
            valuekey = key(A[i])
            value = A[i]
            j = i-1
            while j>= 0 and key(A[j]) > valuekey
                A[j + 1] = A[j]
                j = j-1
            end while
            A[j+1] = value
        next

    end if

End Sub

'******************************************************
'Convert anything to a string
'
'Always returns a string
'******************************************************
Function tostr(any)
    ret = AnyToString(any)
    if ret = invalid ret = type(any)
    if ret = invalid ret = "unknown" 'failsafe
    return ret
End Function

'******************************************************
'islist
'
'Determine if the given object supports the ifList interface
'******************************************************
Function islist(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifArray") = invalid return false
    return true
End Function

'******************************************************
' validstr
'
' always return a valid string. if the argument is
' invalid or not a string, return an empty string
'******************************************************
Function validstr(obj As Dynamic) As String
    if isnonemptystr(obj) return obj
    return ""
End Function

'******************************************************
'isstr
'
'Determine if the given object supports the ifString interface
'******************************************************
Function isstr(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifString") = invalid return false
    return true
End Function

'******************************************************
'isnonemptystr
'
'Determine if the given object supports the ifString interface
'and returns a string of non zero length
'******************************************************
Function isnonemptystr(obj)
    if isnullorempty(obj) return false
    return true
End Function

'******************************************************
'isnullorempty
'
'Determine if the given object is invalid or supports
'the ifString interface and returns a string of non zero length
'******************************************************
Function isnullorempty(obj)
    if obj = invalid return true
    if not isstr(obj) return true
    if Len(obj) = 0 return true
    return false
End Function

'******************************************************
'isbool
'
'Determine if the given object supports the ifBoolean interface
'******************************************************
Function isbool(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifBoolean") = invalid return false
    return true
End Function

'******************************************************
'strtobool
'
'Convert string to boolean safely. Don't crash
'Looks for certain string values
'******************************************************
Function strtobool(obj As dynamic) As Boolean
    if obj = invalid return false
    if type(obj) <> "roString" and type(obj) <> "String" return false
    o = strTrim(obj)
    o = Lcase(o)
    if o = "true" return true
    if o = "t" return true
    if o = "y" return true
    if o = "1" return true
    return false
End Function

Function DoubleToString(x as Double) as String
   onemill# = 1000000
   xhi = Int(x#/onemill#).toStr()
   xlo = Int((x#-onemill#*Int(x#/onemill#))).toStr()
   xlo = String(6-xlo.Len(),"0") + xlo
   return xhi+xlo
End Function

'******************************************************
'Get remaining hours from a total seconds
'******************************************************
Function hoursLeft(seconds As Integer) As Integer
    hours% = seconds / 3600
    return hours%
End Function

'******************************************************
'Get remaining minutes from a total seconds
'******************************************************
Function minutesLeft(seconds As Integer) As Integer
    hours% = seconds / 3600
    mins% = seconds - (hours% * 3600)
    mins% = mins% / 60
    return mins%
End Function

'******************************************************
'Tokenize a string. Return roList of strings
'******************************************************
Function strTokenize(str As String, delim As String) As Object
    st=CreateObject("roString")
    st.SetString(str)
    return st.Tokenize(delim)
End Function

'******************************************************
'Replace substrings in a string. Return new string
'******************************************************
Function strReplace(basestr As String, oldsub As String, newsub As String) As String
    newstr = ""

    i = 1
    while i <= Len(basestr)
        x = Instr(i, basestr, oldsub)
        if x = 0 then
            newstr = newstr + Mid(basestr, i)
            exit while
        endif

        if x > i then
            newstr = newstr + Mid(basestr, i, x-i)
            i = x
        endif

        newstr = newstr + newsub
        i = i + Len(oldsub)
    end while

    return newstr
End Function

'******************************************************
'Walk an AA and print it
'******************************************************
Sub PrintAA(aa as Object)
    print "---- AA ----"
    if aa = invalid
        print "invalid"
        return
    else
        cnt = 0
        for each e in aa
            x = aa[e]
            PrintAny(0, e + ": ", aa[e])
            cnt = cnt + 1
        next
        if cnt = 0
            PrintAny(0, "Nothing from for each. Looks like :", aa)
        endif
    endif
    print "------------"
End Sub

'******************************************************
'Walk a list and print it
'******************************************************
Sub PrintList(list as Object)
    print "---- list ----"
    PrintAnyList(0, list)
    print "--------------"
End Sub

'******************************************************
'Print an associativearray
'******************************************************
Sub PrintAnyAA(depth As Integer, aa as Object)
    for each e in aa
        x = aa[e]
        PrintAny(depth, e + ": ", aa[e])
    next
End Sub

'******************************************************
'Print a list with indent depth
'******************************************************
Sub PrintAnyList(depth As Integer, list as Object)
    i = 0
    for each e in list
        PrintAny(depth, "List(" + itostr(i) + ")= ", e)
        i = i + 1
    next
End Sub

'******************************************************
'Print anything
'******************************************************
Sub PrintAny(depth As Integer, prefix As String, any As Dynamic)
    if depth >= 10
        print "**** TOO DEEP " + itostr(5)
        return
    endif
    prefix = string(depth*2," ") + prefix
    depth = depth + 1
    str = AnyToString(any)
    if str <> invalid
        print prefix + str
        return
    endif
    if type(any) = "roAssociativeArray"
        print prefix + "(assocarr)..."
        PrintAnyAA(depth, any)
        return
    endif
    if islist(any) = true
        print prefix + "(list of " + itostr(any.Count()) + ")..."
        PrintAnyList(depth, any)
        return
    endif

    print prefix + "?" + type(any) + "?"
End Sub

'******************************************************
'Print an object as a string for debugging. If it is
'very long print the first 500 chars.
'******************************************************
Sub Dbg(pre As Dynamic, o=invalid As Dynamic)
    p = AnyToString(pre)
    if p = invalid p = ""
    if o = invalid o = ""
    s = AnyToString(o)
    if s = invalid s = "???: " + type(o)
    if Len(s) > 4000
        s = Left(s, 4000)
    endif
    print p + s
End Sub

'******************************************************
'Try to convert anything to a string. Only works on simple items.
'
'Test with this script...
'
'    s$ = "yo1"
'    ss = "yo2"
'    i% = 111
'    ii = 222
'    f! = 333.333
'    ff = 444.444
'    d# = 555.555
'    dd = 555.555
'    bb = true
'
'    so = CreateObject("roString")
'    so.SetString("strobj")
'    io = CreateObject("roInt")
'    io.SetInt(666)
'    tm = CreateObject("roTimespan")
'
'    Dbg("", s$ ) 'call the Dbg() function which calls AnyToString()
'    Dbg("", ss )
'    Dbg("", "yo3")
'    Dbg("", i% )
'    Dbg("", ii )
'    Dbg("", 2222 )
'    Dbg("", f! )
'    Dbg("", ff )
'    Dbg("", 3333.3333 )
'    Dbg("", d# )
'    Dbg("", dd )
'    Dbg("", so )
'    Dbg("", io )
'    Dbg("", bb )
'    Dbg("", true )
'    Dbg("", tm )
'
'try to convert an object to a string. return invalid if can't
'******************************************************
Function AnyToString(any As Dynamic) As dynamic
    if any = invalid return "invalid"
    if isstr(any) return any
    if isInt(any) return itostr(any)
    if isbool(any)
        if any = true return "true"
        return "false"
    endif
    if isFloat(any) return Str(any)
    if type(any) = "roTimespan" return itostr(any.TotalMilliseconds()) + "ms"
    return invalid
End Function

'******************************************************
'Dump the bytes of a string
'******************************************************
Sub DumpString(str As String)
    print "DUMP STRING"
    print "---------------------------"
    print str
    print "---------------------------"
    l = Len(str)-1
    i = 0
    for i = 0 to l
        c = Mid(str, i)
        val = Asc(c)
        print itostr(val)
    next
    print "---------------------------"
End Sub

'**********************************************************
'** Format Time From Seconds
'**********************************************************

Function formatTime(seconds As Integer) As String
    if validateParam(seconds, "roInt", "formatTime") = false return -1

    textTime = ""
    hasHours = false

    ' Special Check For Zero
    if seconds < 60
        return "0:" + ZeroPad(itostr(seconds))
    end if
    
    ' Hours
    if seconds >= 3600
        textTime = textTime + itostr(seconds / 3600) + ":"
        hasHours = true
        seconds = seconds Mod 3600
    end if
    
    ' Minutes
    if seconds >= 60
        if hasHours
            textTime = textTime + ZeroPad(itostr(seconds / 60)) + ":"
        else
            textTime = textTime + itostr(seconds / 60) + ":"
        end if
        
        seconds = seconds Mod 60
    else
        if hasHours
            textTime = textTime + "00:"
        end if
    end if

    ' Seconds
    textTime = textTime + ZeroPad(itostr(seconds))

    return textTime
End Function

'Turns an integer into a comma-separated numeric representation (1,234,567)
Function PrettyInteger(value as Integer) as String
    s = itostr(value)
    r = CreateObject("roRegex", "(\d+)(\d{3})", "")
    while r.IsMatch(s)
        s = r.Replace(s, "\1,\2")
    end while
    return s
End Function

Function GetManifestArray() as Object
    manifest = ReadAsciiFile("pkg:/manifest")
    lines = manifest.Tokenize(chr(10))
    aa = {}
    for each line in lines
        entry = line.Tokenize("=")
        aa.AddReplace(entry[0],entry[1].Trim())
    end for
    print aa
    return aa
End Function

Function Is720p() as Boolean
    resinfo = CreateObject("roDeviceInfo")
    return resinfo.GetDisplayMode() = "720p"
End Function

Function ArrayToString(input As Object) As String
    output = ""
    for each item in input
        output = output + item + ","
    next
    if Len(output) > 1
        output = Left(output,Len(output)-1)
    end if
    return output
End Function

Function StringToArray(input as String) As Object
    output = CreateObject("roArray", 0, True)
    while Len(input) > 0
        p = instr(1,input,",")
        if p > 0
            output.Push(Left(input, p-1))
            input = Mid(input,p+1)
        else
            output.Push(input)
            input = ""
        end if
    end while
    return output
End Function

Function BoolToString(value as Boolean) As String
    if value
       return "Yes"
    else
       return "No"
    end if
End Function

Function IntToBool(value as Integer) as Boolean
    return not (value <> 0)
End Function

Function BoolToInt(value as Boolean) as Integer
    if value
       return 1
    else
       return 0
    end if
End Function

Function iVal(value as String) as Integer
    return int(val(value.Trim()))
End Function

Function InsertOnArray(array as Dynamic, item as Dynamic, index as integer) as Dynamic
	copy = []
	For i = 0 to array.Count() - 1
		if i = index
			copy.Push(item)
		end if
		copy.Push(array[i])
	Next
	return copy
End Function

Function ShallowCopy(array As Dynamic, depth = 0 As Integer) As Dynamic
    If Type(array) = "roArray" Then
        copy = []
        For Each item In array
            childCopy = ShallowCopy(item, depth)
            If childCopy <> invalid Then
                copy.Push(childCopy)
            End If
        Next
        Return copy
    Else If Type(array) = "roAssociativeArray" Then
        copy = {}
        For Each key In array
            If depth > 0 Then
                copy[key] = ShallowCopy(array[key], depth - 1)
            Else
                copy[key] = array[key]
            End If
        Next
        Return copy
    Else
        Return array
    End If
    Return invalid
End Function
