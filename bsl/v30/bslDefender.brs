' bslDefender
' BrighScript 2D graphics library
' Aug 23, 2010
' ajw
'
Library "v30/bslCore.brs"
function toint(x)
    if x = invalid then return 0
    return strtoi(x)
end function
function h2i(x)
    if x = invalid then return 0
    return HexToInteger(x)
end function
function dfRedChannel(color as integer) as integer
    return color >> 24
end function
function dfGreenChannel(color as integer) as integer
    return color >> 16 and &hFF
end function
function dfBlueChannel(color as integer) as integer
    return color >> 8 and &hFF
end function
function dfAlphaChannel(color as integer) as integer
    return color and &hFF
end function
function dfRGBA(red as integer, green as integer, blue as integer, alpha as integer) as integer
    return red << 24 or green << 16 or blue << 8 or alpha
end function
function dfNewBitmapSet(bitmap_set_string)
    bitmap_set = CreateObject("roXMLElement")
    if bitmap_set = invalid
        print "dfNewBitmapSet: Unexpected error creating roXMLElement."
        return invalid
    end if
    if not bitmap_set.Parse(bitmap_set_string)
        print "dfNewBitmapSet: Error parsing XML: ";left(bitmap_set_string, 20);"..."
        return invalid
    end if
    set = { ExtraInfo: {}, Backgrounds: {}, Regions: {}, Animations: {}, TickList: [] }
    extra_xmllist = bitmap_set.ExtraInfo
    if not extra_xmllist.IsEmpty() then set.ExtraInfo.Append(extra_xmllist.GetAttributes())
    bitmap_xmllist = bitmap_set.Bitmap
    if bitmap_xmllist.IsEmpty()
        print "dfNewBitmapSet: no <Bitmap> tag in BitmapSet"
        return invalid
    end if
    for each bitmap_element in bitmap_xmllist
		bitmap_attr = bitmap_element.getAttributes()
        if bitmap_attr["filespec"] <> invalid
            bm = CreateObject("roBitmap", bitmap_attr["filespec"])
            if bm = invalid
                print "dfNewBitmapSet: Error creating roBitmap from file ";bitmap_attr["filespec"]
                return invalid
            end if
        else if bitmap_attr["shape"] <> invalid
            if bitmap_attr["shape"] <> "rect"
                print "dfNewBitmapSet: Invalid shape"
                return invalid
            end if
            color = h2i(bitmap_attr["color"])
            bm = CreateObject("roBitmap", { width: toint(bitmap_attr["w"]), height: toint(bitmap_attr["h"]), AlphaEnable: 255 <> (color and 255) })
            if bm = invalid
                print "dfNewBitmapSet: Error creating roBitmap from shape"
                return invalid
            end if
            bm.Clear(color)
        else
            print "dfNewBitmapSet: Error creating roBitmap.  No filespec or shape attribute."
            return invalid
        end if
        if bitmap_attr["name"] = invalid
            print "dfNewBitmapSet: <Bitmap> missing a name attribute."
            return invalid
        end if
        r = CreateObject("roRegion", bm, 0, 0, bm.GetWidth(), bm.GetHeight())
        r.SetTime(toint(bitmap_attr["t"]))
        set.Regions[bitmap_attr["name"]] = r
        for each region_element in bitmap_element.Region
			region_attr = region_element.getAttributes()
            r = CreateObject("roRegion", bm, toint(region_attr["x"]), toint(region_attr["y"]), toint(region_attr["w"]), toint(region_attr["h"]))
            if type(r) <> "roRegion"
                print "dfNewBitmapSet: <Region> invalid: ";bitmap_attr["name"] + "." + region_attr["name"]
            else
                r.SetTime(toint(region_attr["t"]))
                set.Regions[bitmap_attr["name"] + "." + region_attr["name"]] = r
            end if
        end for
    end for
    background_xmllist = bitmap_set.Background
    if background_xmllist.IsEmpty()
        print "dfNewBitmapSet: no <Background> tag in BitmapSet"
    end if
    for each background_element in background_xmllist
		back_attr = background_element.getAttributes()
        if back_attr["filespec"] <> invalid and back_attr["name"] <> invalid 
            set.Backgrounds[back_attr["name"]] = back_attr["filespec"]
        end if
    end for
    animation_xmllist = bitmap_set.Animation
    if not animation_xmllist.IsEmpty()
        for each animation_element in animation_xmllist
			anima_attr = animation_element.getAttributes()
            frame_array = []
            for each frame_element in animation_element.Frame
				frame_attr = frame_element.getAttributes()
                if frame_attr["use"] = invalid or not set.regions.DoesExist(frame_attr["use"])
                    print "dfNewBitmapSet: <Frame> tag has missing or invalid USE attribute"
                    return invalid
                end if
                frame_array.push(set.Regions[frame_attr["use"]])
            end for
            if anima_attr["name"] = invalid
                print "dfNewBitmapSet: <Animation> tag is missing NAME attribute"
                return invalid
            end if
            set.Animations[anima_attr["name"]] = frame_array
        end for
    end if
    return set
end function
function dfDrawMessage(dest, region)
    dest.DrawRect(0, 0, dest.getwidth(), dest.getheight(), &h90)
    dest.DrawObject((dest.getwidth() - region.GetWidth()) / 2, (dest.getheight() - region.GetHeight()) / 2, region.GetBitmap())
    dest.Finish()
end function
function dfDrawImage(dest, filename, dest_x, dest_y) as boolean
    return dest.DrawObject(dest_x, dest_y, createobject("robitmap", filename))
end function
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
    if topx <> 0
        sidebar_w = scr_w - width
        left_w = int(sidebar_w / 2)
        right_w = sidebar_w - left_w
        left = createobject("roregion", screen, 0, 0, right_w, scr_h)
        right = createobject("roregion", screen, topx + width, 0, right_w, scr_h)
    end if
    if topy <> 0
        letterb_h = scr_h - height
        upper_h = int(letterb_h / 2)
        lower_h = letterb_h - upper_h
        upper = createobject("roregion", screen, left_w, 0, scr_w - sidebar_w, upper_h)
        lower = createobject("roregion", screen, left_w, topy + height, scr_w - sidebar_w, lower_h)
    end if
    return {main: mainregion, left: left, right: right, upper: upper, lower: lower}
end function
function dfSetBackground(backgroundName, backgrounds)
    if backgrounds[backgroundName] <> invalid and backgrounds[backgroundName] <> ""
        bm = CreateObject("roBitmap", backgrounds[backgroundName])
        if bm = invalid
            print "dfSetBackground: Error creating roBitmap from file ";backgrounds[backgroundName]
            return invalid
        end if
    else
        print "dfSetBackground: Error backgrounds = ";backgrounds;" backgroundName = ";backgroundName " File = ";backgrounds[backgroundName]
        return invalid
    end if
    r = CreateObject("roRegion", bm, 0, 0, bm.GetWidth(), bm.GetHeight())
    return r
end function
