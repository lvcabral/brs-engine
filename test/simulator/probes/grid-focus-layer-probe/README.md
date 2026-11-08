# Grid Focus Layer Probe

This probe shows how a device layers a list's or grid's focus indicator against opaque items **while the focus moves**. Draw order isn't observable from BrightScript, so the evidence is dev-mode screenshots taken mid-motion.

## Shape

The scene is HD and contains:

- MarkupGrid `under`: one row of 8 opaque colored cells, default focus ring, `drawFocusFeedbackOnTop=false`. It has focus at launch.
- MarkupGrid `over`: the same, with `drawFocusFeedbackOnTop=true`. Down focuses it, Up returns to `under`.
- LabelList `list`: `floatingFocus`, 4 rows. Play focuses it.
- MarkupList `mlist`: narrow opaque cells, `floatingFocus`, 4 rows. Options (ECP `Info`) focuses it.
- RowList `rows`: one row of 8 opaque cells. InstantReplay focuses it.

## Capture

Hold the navigation key with ECP so the focus glides continuously, then take a screenshot mid-glide and release:

```
curl -d '' http://<ip>:8060/keydown/Right            # or Down for the lists
sleep 0.85
curl --digest -u rokudev:<pw> -F mysubmit=Screenshot -F passwd= -F archive= http://<ip>/plugin_inspect
curl -d '' http://<ip>:8060/keyup/Right
curl --digest -u rokudev:<pw> http://<ip>/pkgs/dev.jpg -o shot.jpg
```

## Findings (Roku Express 4K+, OS 16.0)

| Screenshot | Node | Moving indicator vs. items |
| --- | --- | --- |
| `device-markupgrid-glide-ontop-false.jpg` | MarkupGrid, `drawFocusFeedbackOnTop=false` | **over** every cell it crosses |
| `device-markupgrid-glide-ontop-true.jpg` | MarkupGrid, `drawFocusFeedbackOnTop=true` | **over** (same as `false`) |
| `device-labellist-scroll.jpg` | LabelList | **under** the text (the focused label is drawn on the highlight) |
| `device-markuplist-scroll.jpg` | MarkupList | **under** every item it crosses |
| `device-rowlist-glide.jpg` | RowList (one row; focused with InstantReplay) | **over** the cells, like a grid |

In `device-rest.jpg`, the ring at rest surrounds its cell with the outset showing, so the at-rest order can't be told apart from these images.

The engine follows the table: `ArrayGrid.renderMotionFocus` is called after the cells by MarkupGrid and PosterGrid, and before the items by LabelList and MarkupList (after them with `drawFocusFeedbackOnTop`). PosterGrid wasn't captured, because it needs real poster images; it is assumed to behave like MarkupGrid.
