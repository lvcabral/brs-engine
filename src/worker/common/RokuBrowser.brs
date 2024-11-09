sub RokuBrowser(ndk as object, app as string, options as object)
    if options = invalid
        options = {}
    end if
    if ndk <> invalid and app <> invalid
        options.url = app
        ndk.start("RokuBrowser", options)
    end if
end sub