function Roku_Ads() as object
    this = {adurl:""}
    this.setAdUrl = sub(url="")
        m.adurl = url
    end sub
    this.getAdUrl = function() as string
        return m.adurl
    end function
    this.getAds = function(msg=invalid) as object
        return {}
    end function
    this.showAds = function(ads,ctx=invalid,view=invalid) as boolean
        return true
    end function
    this.setContentId = sub(id="")
    end sub
    this.setContentLength = sub(length = 0)
    end sub
    this.setContentGenre = sub(genres=invalid,kids=false)
    end sub
    this.setAdExit = sub(allow)
    end sub
    this.setDebugOutput = sub(enable)
    end sub
    this.enableAdMeasurements = sub(enable)
    end sub
    this.setAdBufferScreenLayer = sub(zOrder,content)
    end sub
    this.enableAdBufferMessaging = sub(enableMsg, enablePB)
    end sub
    this.setAdPrefs = sub(useRokuAdsAsFallback, maxRequests)
    end sub
    return this
end function
