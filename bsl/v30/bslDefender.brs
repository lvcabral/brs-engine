'
' bslDefender
' BrighScript 2D graphics library
'
' Aug 23, 2010
' ajw
'

' TODO
' Sprites with filespec currently don't support alpha -- easy to add but need to.
' be able to tag a bitmap as not collidable
' Use ID instead of NAME?
' It would be helpful if an "object" could be created that is an AA, but has a certain type
' add threads or something to handle animations?

Library "v30/bslCore.brs"

function toint(x)
   if x=invalid return 0
   return strtoi(x)
end function

function h2i(x)
   if x=invalid return 0
   return HexToInteger(x)
end function

Function dfRedChannel(color as integer) as integer
    return color >> 24
End Function

Function dfGreenChannel(color as integer) as integer
    return color >> 16 AND &hFF
End Function

Function dfBlueChannel(color as integer) as integer
    return color >> 8 AND &hFF
End Function

Function dfAlphaChannel(color as integer) as integer
    return color AND &hFF
End Function

Function dfRGBA(red as integer, green as integer, blue as integer, alpha as integer) as integer
    return red << 24 OR green << 16 OR blue << 8 OR alpha
End Function

' EXAMPLE:
'
'<DefenderBitmapSet>
'       <Bitmap name="Background" filespec="pkg:/snake_assets/snake.background.png" />
'       <Bitmap name="game-over" filespec="pkg:/snake_assets/snake.gameover.png" />
'       <Bitmap filespec="pkg:/snake_assets/snake.sprites.small.png">
'               <Region name="butt-North"          x="00" y="00" w="28" h="28" />
'       </Bitmap>
'</DefenderBitmapSet>


function dfNewBitmapSet(bitmap_set_string)      
        
    bitmap_set=CreateObject("roXMLElement")
    if bitmap_set=invalid then 
        print "dfNewBitmapSet: Unexpected error creating roXMLElement."
        return invalid
    end if

    if not bitmap_set.Parse(bitmap_set_string) then 
                print "dfNewBitmapSet: Error parsing XML: ";left(bitmap_set_string, 20);"..."
        return invalid
    end if
    
    set = { ExtraInfo: {}, Backgrounds: {}, Regions: {}, Animations: {}, TickList: [] }

        ' *******
        ' ******* Is there any "ExtraInfo" (application sepecific data)
        ' *******
        extra_xmllist=bitmap_set.ExtraInfo
        if not extra_xmllist.IsEmpty() then set.ExtraInfo.Append(extra_xmllist.GetAttributes())  ' !!!!!! need to add append function

        ' *******
        ' ******* Add each <Bitmap> & <Region> to set
        ' *******
        bitmap_xmllist = bitmap_set.Bitmap
        if bitmap_xmllist.IsEmpty() then
                print "dfNewBitmapSet: no <Bitmap> tag in BitmapSet"
                return invalid
        end if
        
        for each bitmap_element in bitmap_xmllist
                if bitmap_element@filespec<>invalid then
                        bm = CreateObject("roBitmap", bitmap_element@filespec)
                        if bm=invalid then
                                print "dfNewBitmapSet: Error creating roBitmap from file ";bitmap_element@filespec
                                return invalid
                        end if
                else if bitmap_element@shape<>invalid then
                        if bitmap_element@shape<>"rect" then 
                                print "dfNewBitmapSet: Invalid shape"
                                return invalid
                        end if
                        
                        color=h2i(bitmap_element@color)
                        bm = CreateObject("roBitmap", {width: toint(bitmap_element@w), height: toint(bitmap_element@h), AlphaEnable: 255<>(color and 255) } )
                        if bm=invalid then
                                print "dfNewBitmapSet: Error creating roBitmap from shape"
                                return invalid
                        end if
                        
                        bm.Clear(color)
                else
                        print "dfNewBitmapSet: Error creating roBitmap.  No filespec or shape attribute."
                        return invalid
                end if
                
                if bitmap_element@name=invalid then
                        print "dfNewBitmapSet: <Bitmap> missing a name attribute."
                        return invalid
                end if
                
                r=CreateObject("roRegion", bm, 0, 0, bm.GetWidth(), bm.GetHeight())
                r.SetTime(toint(bitmap_element@t))
                set.Regions[bitmap_element@name]=r
                
                for each region_element in bitmap_element.Region
                        r=CreateObject("roRegion", bm, toint(region_element@x), toint(region_element@y), toint(region_element@w), toint(region_element@h))
                        if type(r)<>"roRegion" then
                                print "dfNewBitmapSet: <Region> invalid: ";bitmap_element@name+"."+region_element@name
                        else
                                r.SetTime(toint(region_element@t))
                                set.Regions[bitmap_element@name+"."+region_element@name]=r
                        end if
                end for
        end for

        background_xmllist = bitmap_set.Background
        if background_xmllist.IsEmpty() then
                print "dfNewBitmapSet: no <Background> tag in BitmapSet"
        end if
        
        for each background_element in background_xmllist
                if background_element@filespec<>invalid and  background_element@name<>invalid then
                    set.Backgrounds[background_element@name] = background_element@filespec
                end if
        end for

        ' *******
        ' ******* process <Animation> tags
        ' *******
        animation_xmllist=bitmap_set.Animation
        if not animation_xmllist.IsEmpty() then 
                for each animation_element in animation_xmllist
                        frame_array = []
                        for each frame_element in animation_element.Frame
                                if frame_element@use=invalid OR not set.regions.DoesExist(frame_element@use) then
                                        print "dfNewBitmapSet: <Frame> tag has missing or invalid USE attribute"
                                        return invalid
                                end if
                                frame_array.push(set.Regions[frame_element@use])
                        end for
                        
                        if animation_element@name=invalid then
                                print "dfNewBitmapSet: <Animation> tag is missing NAME attribute"
                                return invalid
                        end if
                        set.Animations[animation_element@name]=frame_array
                end for
                
        end if
        
        return set
        
end function


function dfDrawMessage(dest, region)
        dest.DrawRect(0,0,dest.getwidth(), dest.getheight(), &h90)   ' alpha the whole screen
        dest.DrawObject((dest.getwidth()-region.GetWidth())/2,(dest.getheight()-region.GetHeight())/2, region.GetBitmap())
        dest.Finish()
end function

function dfDrawImage(dest, filename, dest_x, dest_y) as boolean
        return dest.DrawObject(dest_x, dest_y, createobject("robitmap",filename))
end function

REM returns an associative array with regions created for drawing
function dfSetupDisplayRegions(screen, topx, topy, width, height) as object
    mainregion = createobject("roregion", screen, topx, topy, width, height)
    left = invalid
    right = invalid
    upper = invalid
    lower = invalid
    scr_w = screen.getwidth()
    scr_h = screen.getheight()
    sidebar_w = 0
    left_w = 0
    if topx <> 0        ' do we need sidebars?
        sidebar_w = scr_w - width
        left_w = int(sidebar_w/2)
        right_w = sidebar_w - left_w
        left = createobject("roregion", screen, 0, 0, right_w, scr_h)
        right = createobject("roregion", screen, topx+width, 0, right_w, scr_h)
    endif
    ' allow for centering of image with bars on all four sides
    if topy <> 0 ' do we need to letterbox?
        letterb_h = scr_h - height
        upper_h = int(letterb_h/2)
        lower_h = letterb_h - upper_h
        upper = createobject("roregion", screen, left_w, 0, scr_w - sidebar_w, upper_h)
        lower = createobject("roregion", screen, left_w, topy+height, scr_w - sidebar_w, lower_h)
    endif
    return {    main: mainregion
                left: left
                right: right
                upper: upper
                lower: lower
            }
end function

function dfSetBackground(backgroundName, backgrounds)      
    if backgrounds[backgroundName]<>invalid and backgrounds[backgroundName]<>"" then
        bm = CreateObject("roBitmap", backgrounds[backgroundName])
        if bm=invalid then
            print "dfSetBackground: Error creating roBitmap from file ";backgrounds[backgroundName]
            return invalid
        end if
    else
        print "dfSetBackground: Error backgrounds = ";backgrounds;" backgroundName = ";backgroundName " File = ";backgrounds[backgroundName]
        return invalid
    end if
    r=CreateObject("roRegion", bm, 0, 0, bm.GetWidth(), bm.GetHeight())
    return r
end function
