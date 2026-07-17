' Mock of the Roku Advertising Framework (RAF) library.
' Mirrors the API surface documented in the Roku developer docs (raf-api), storing
' configuration and firing tracking callbacks, but never contacting an ad server
' and never rendering ad UI: getAds() only returns pods imported by the app, and
' showAds()/renderStitchedStream() report completed playback without rendering.
function Roku_Ads() as object
    ' The RAF object has global scope on Roku: every call returns the same instance,
    ' so wrappers/flags apps attach to it must survive re-fetching the library.
    globalAA = GetGlobalAA()
    if globalAA["__roku_ads_instance"] <> invalid
        return globalAA["__roku_ads_instance"]
    end if
    this = {adurl: "", adpods: []}

    ' Control
    this.fireTrackingEvents = function(adStructure = invalid, ctx = invalid) as boolean
        if m.trackingcallback <> invalid
            evtType = invalid
            if ctx <> invalid and ctx.type <> invalid
                evtType = ctx.type
            end if
            m.trackingcallback(m.trackingobj, evtType, ctx)
        end if
        return true
    end function
    this.getAds = function(msg = invalid) as dynamic
        if msg <> invalid
            ' Event-listener mode: no midroll/postroll pods are ever scheduled by the mock
            return invalid
        end if
        return m.adpods
    end function
    this.showAds = function(ads, ctx = invalid, view = invalid) as boolean
        return true
    end function

    ' Configuration
    this.setAdUrl = sub(url = "")
        m.adurl = url
    end sub
    this.getAdUrl = function() as string
        return m.adurl
    end function
    this.setAdPrefs = sub(useRokuAdsAsFallback = true, maxRequests = 0)
    end sub
    this.setAdConstraints = sub(maxHeight = 0, maxWidth = 0, maxBitrate = 0, supportedMimeTypes = invalid)
    end sub
    this.setAdBreaks = sub(contentLength = 0, adBreakTimes = invalid)
    end sub
    this.setAdExit = sub(enabled = true)
        ' deprecated and disabled on Roku - check showAds() return value instead
    end sub
    this.importAds = sub(adPodArray = invalid)
        if adPodArray <> invalid
            m.adpods = adPodArray
        else
            m.adpods = []
        end if
    end sub
    this.enableJITPods = sub(enabled = false)
    end sub
    this.enableInPodStitching = sub(isIPS = false)
    end sub
    this.setLimitAdTracking = sub(enabled = false)
    end sub
    this.setTrackingCallback = sub(callback = invalid, obj = invalid)
        m.trackingcallback = callback
        m.trackingobj = obj
    end sub
    this.setDebugOutput = sub(enabled = false)
    end sub
    this.getLibVersion = function() as string
        return "3.5"
    end function

    ' General audience measurement
    this.enableAdMeasurements = sub(enabled = false)
    end sub
    this.setContentGenre = sub(genres = invalid, kidsContent = false)
    end sub
    this.setContentId = sub(id = "")
    end sub
    this.setContentLength = sub(length = 0)
    end sub

    ' Nielsen DAR (deprecated on Roku, kept because existing apps still call them)
    this.enableNielsenDAR = sub(enabled = false)
    end sub
    this.setNielsenGenre = sub(genre = "")
    end sub
    this.setNielsenAppId = sub(id = "")
    end sub
    this.setNielsenProgramId = sub(id = "")
    end sub

    ' Nielsen DCR
    this.getNielsenContentData = function() as string
        return ""
    end function

    ' Client stitched ads
    this.constructStitchedStream = function(contentMetaData = invalid, ads = invalid) as dynamic
        ' No stitching in the mock: the "stitched" stream is the content itself, ad-free
        return contentMetaData
    end function
    this.renderStitchedStream = function(csasStream = invalid, view = invalid) as boolean
        return true
    end function

    ' Server stitched ads
    this.stitchedAdsInit = sub(adPodArray = invalid)
        if adPodArray <> invalid
            m.adpods = adPodArray
        else
            m.adpods = []
        end if
    end sub
    this.stitchedAdHandledEvent = function(msg = invalid, player = invalid) as dynamic
        ' No stitched ad is ever being rendered by the mock
        return invalid
    end function

    ' Buffer screen customization
    this.setAdBufferScreenContent = sub(contentMetaData = invalid)
    end sub
    this.enableAdBufferMessaging = sub(enableMsg = true, enableProgressBar = true)
    end sub
    this.setAdBufferScreenLayer = sub(zOrder = 0, contentMetaData = invalid)
    end sub
    this.clearAdBufferScreenLayers = sub()
    end sub
    this.setAdBufferRenderCallback = sub(callback = invalid, obj = invalid, timeout = 0)
    end sub

    globalAA["__roku_ads_instance"] = this
    return this
end function
