' Demo of the Roku OS 16.0 "Effect" node: GPU-accelerated rounded corners, borders and
' linear/radial gradients applied to Poster and Rectangle nodes via their new `effect` field.
' brs-engine renders this through Canvas2D rather than a real shader pipeline (see
' src/extensions/scenegraph/nodes/Effect.ts) but every field below behaves per the release notes:
' external/dev-doc/docs/DEVELOPER/release-notes/index.md ("Roku OS 16.0 Beta Release").

sub init()
    m.top.backgroundColor = "#12141aFF"

    title = MakeLabel(m.top, 60, 20, 1160, "Effect Node Demo", "font:ExtraLargeBoldSystemFont", "#F5F5F7FF")
    title.horizAlign = "left"

    subtitle = MakeLabel(
        m.top,
        60,
        62,
        1160,
        "Roku OS 16.0 - rounded corners, borders and gradients on Rectangle/Poster via a new Effect node",
        "font:SmallSystemFont",
        "#A9ADBAFF"
    )
    subtitle.horizAlign = "left"

    cols = [60, 460, 860]
    cellWidth = 360
    shapeWidth = 280
    shapeHeight = 130
    captionHeight = 28
    rows = [104, 302, 500]

    ' --- Row 1: Rectangle demos -------------------------------------------------------------
    BuildPanel(
        m.top, cols[0], rows[0], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "1. Uniform rounded corners", "rect", "#3A7BFDFF",
        { borderRadius: [24] }
    )

    ' borderRadius is [topRight, bottomRight, bottomLeft, topLeft] - clockwise from top-right -
    ' so this rounds only the top-right and bottom-left corners.
    BuildPanel(
        m.top, cols[1], rows[0], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "2. Per-corner radius", "rect", "#FDCB3AFF",
        { borderRadius: [60, 0, 60, 0] }
    )

    BuildPanel(
        m.top, cols[2], rows[0], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "3. Border + padding, no rounding", "rect", "#2F323BFF",
        { borderWidth: 6, borderPadding: 10, borderColor: "#3AFD8FFF" }
    )

    ' --- Row 2: Rectangle demos -------------------------------------------------------------
    BuildPanel(
        m.top, cols[0], rows[1], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "4. Rounded + border + padding", "rect", "#8F3AFDFF",
        { borderRadius: [20], borderWidth: 6, borderPadding: 8, borderColor: "#FFFFFFFF" }
    )

    BuildPanel(
        m.top, cols[1], rows[1], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "5. Linear gradient fill", "rect", "#000000FF",
        {
            borderRadius: [20],
            gradientStyle: "linear",
            gradientAngle: 45,
            gradientColors: ["#FF5F6DFF", "#FFC371FF"]
        }
    )

    BuildPanel(
        m.top, cols[2], rows[1], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "6. Radial gradient fill", "rect", "#000000FF",
        {
            borderRadius: [20],
            gradientStyle: "radial",
            gradientColors: ["#00C9FFFF", "#92FE9DFF"]
        }
    )

    ' --- Row 3: one more Rectangle, then Poster demos ---------------------------------------
    BuildPanel(
        m.top, cols[0], rows[2], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "7. Gradient on content + border", "rect", "#000000FF",
        {
            borderRadius: [24],
            borderWidth: 10,
            borderPadding: 4,
            gradientStyle: "linear",
            gradientAngle: 90,
            gradientFillBorder: true,
            gradientColors: ["#F72585FF", "#7209B7FF", "#3A0CA3FF"]
        }
    )

    BuildPanel(
        m.top, cols[1], rows[2], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "8. Poster with rounded corners", "poster", "",
        { borderRadius: [30] }
    )

    BuildPanel(
        m.top, cols[2], rows[2], cellWidth, shapeWidth, shapeHeight, captionHeight,
        "9. Poster: rounded + border + fade", "poster", "",
        {
            borderRadius: [16],
            borderWidth: 6,
            borderColor: "#FFFFFFFF",
            gradientStyle: "linear",
            gradientAngle: 180,
            gradientFillContent: true,
            gradientColors: ["#00000000", "#000000CC"]
        }
    )

    footer = MakeLabel(
        m.top,
        60,
        686,
        1160,
        "brs-engine approximates the effect with Canvas2D (rounded clip path, gradient fill, stroke) - see .claude/docs and Effect.ts",
        "font:SmallestSystemFont",
        "#6B7080FF"
    )
    footer.horizAlign = "left"
end sub

' Builds one caption + shape panel and applies an Effect node built from `fields` (an assocarray
' of Effect field name -> value) onto the shape.
sub BuildPanel(parent as object, colX as float, rowY as float, cellWidth as float, shapeWidth as float, shapeHeight as float, captionHeight as float, caption as string, kind as string, color as string, fields as object)
    MakeLabel(parent, colX, rowY, cellWidth, caption, "font:SmallBoldSystemFont", "#E6E6E6FF")

    shapeX = colX + (cellWidth - shapeWidth) / 2
    shapeY = rowY + captionHeight + 10

    if kind = "poster"
        shape = parent.CreateChild("Poster")
        shape.uri = "pkg:/images/demo_photo.jpg"
        shape.loadDisplayMode = "scaleToZoom"
    else
        shape = parent.CreateChild("Rectangle")
        shape.color = color
    end if
    shape.translation = [shapeX, shapeY]
    shape.width = shapeWidth
    shape.height = shapeHeight

    effect = CreateObject("roSGNode", "Effect")
    for each key in fields
        ' setField()'s type check is stricter than plain dot-assignment for a scalar "color"
        ' field (it does not accept a hex string, only a matching numeric type), so borderColor
        ' has to go through normal field assignment instead of the generic setField loop below.
        if LCase(key) = "bordercolor"
            effect.borderColor = fields[key]
        else
            effect.setField(key, fields[key])
        end if
    end for
    shape.effect = effect
end sub

function MakeLabel(parent as object, x as float, y as float, w as float, text as string, fontUri as string, color as string) as object
    label = parent.CreateChild("Label")
    label.translation = [x, y]
    label.width = w
    label.height = 30
    label.horizAlign = "center"
    label.font = fontUri
    label.color = color
    label.text = text
    return label
end function
