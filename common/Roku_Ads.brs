function Roku_Ads() as object
    this = {url:""}
    this.setAdUrl = sub(url="")
        m.url = url
    end sub
    this.getAdUrl = function() as string
        return m.url
    end function
    this.getAds = function(msg=invalid) as object
        return {}
    end function
    this.showAds = function(ads,ctx,view) as boolean
        return true
    end function
    this.setContentId = sub(id="")
    end sub
    this.setContentLength = sub(length = 0)
    end sub
    this.setContentGenre = sub(genres,kids)
    end sub
    this.setAdExit = sub(allow)
    end sub
    this.setDebugOutput = sub(enable)
    end sub
    this.enableAdMeasurements = sub(enable)
    end sub
    return this
end function
