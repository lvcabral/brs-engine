sub RokuBrowser(ndk as object, app as string, options as object)
    if ndk <> invalid and app <> invalid and app.trim() <> ""
        params = ["url=" + app]
        if getInterface(options, "ifAssociativeArray") <> invalid
            for each key in options
                params.push(key + "=" + FormatJson(options[key]))
            end for
        end if
        ndk.start("roku_browser", params)
    end if
end sub