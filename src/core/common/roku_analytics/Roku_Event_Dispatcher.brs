function Roku_Event_Dispatcher() as object
    this = {}
    this.dispatchEvent = sub(pixel, data)
    end sub
    this.setDebugOutput = sub(enable as boolean)
    end sub
    this.setCertificatesFile = sub(file as string)
    end sub
    return this
end function