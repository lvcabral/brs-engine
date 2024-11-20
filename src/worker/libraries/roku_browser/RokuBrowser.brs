sub RokuBrowser(ndk as object, app as string, options as object)
    if ndk <> invalid and app <> invalid and app.trim() <> ""
        params = []
        if getInterface(options, "ifAssociativeArray") <> invalid
            options.url = app
            params.push(formatJson(options))
        end if
        ndk.start("roku_browser", params)
    end if
end sub