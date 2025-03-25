function New_IMASDK() as object
    this = {}
    this.initSDK = sub(settings)
    end sub
    this.requestStream = function(streamRequest)
        return invalid
    end function
    this.getStreamManager = function()
        return invalid
    end function
    this.createStreamRequest = function()
        return {}
    end function
    this.createLiveStreamRequest = function(assetKey, apiKey, networkCode)
        return {}
    end function
    this.createVodStreamRequest = function(contentSourceId, videoId, apiKey, networkCode)
        return {}
    end function
    this.CreatePodLiveStreamRequest = function(customAssetKey, networkCode, apiKey)
        return {}
    end function
    this.CreatePodVodStreamRequest = function(networkCode)
        return {}
    end function
    this.createPlayer = function() as dynamic
        player = {}
        player.loadUrl = sub(urlData)
        end sub
        player.adBreakStarted = sub(adBreakInfo as object)
        end sub
        player.adBreakEnded = sub(adBreakInfo as object)
        end sub
        player.allVideoComplete = sub()
        end sub
        player.seek = sub(timeSeconds as float)
        end sub
        streamInitialized = sub()
        end sub
        return player
    end function
    this.disableLogging = sub()
    this.adEvent = {
        AD_PERIOD_ENDED: "adPeriodEnded"
        AD_PERIOD_STARTED: "adPeriodStarted"
        COMPLETE: "complete"
        CREATIVE_VIEW: "creativeView"
        ERROR: "error"
        FIRST_QUARTILE: "firstQuartile"
        ICON_FALLBACK_IMAGE_CLOSED: "iconFallbackImageClosed"
        ICON_FALLBACK_IMAGE_SHOWN: "iconFallbackImageShown"
        IMPRESSION: "impression"
        MIDPOINT: "midpoint"
        PROGRESS: "progress"
        SKIP: "skip"
        SKIP_SHOWN: "skipShown"
        SKIPPABLE_STATE_CHANGED: "skippableStateChanged"
        SKIPPED: "skipped"
        START: "start"
        THIRD_QUARTILE: "thirdQuartile"
    }
    end sub
    return this
end function