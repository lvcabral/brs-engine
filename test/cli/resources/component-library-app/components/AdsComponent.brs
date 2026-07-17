Library "Roku_Ads.brs"
Library "IMA3.brs"

sub init()
    ' Roku_Ads is gated by bs_libs_required=roku_ads_lib, which the manifest has.
    raf = Roku_Ads()
    m.top.rafType = type(raf)
    raf.setAdUrl("http://ads.example.com/preroll")
    raf.importAds([{ads: [{id: "ad1"}]}])

    ' RAF is a singleton on Roku: a fresh Roku_Ads() call must return the same
    ' instance, seeing the URL and ad pods configured above.
    raf2 = Roku_Ads()
    m.top.adUrl = raf2.getAdUrl()
    m.top.podCount = raf2.getAds().count()
    m.top.libVersion = raf2.getLibVersion()

    ' IMA3 is gated by bs_libs_required=googleima3, which the manifest does NOT have,
    ' so its functions must not resolve even though the Library statement is present.
    try
        sdk = New_IMASDK()
        m.top.imaLoaded = "loaded"
    catch e
        m.top.imaLoaded = "not loaded"
    end try
end sub
