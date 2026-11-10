# Burin

Chiseled letter solids for Luban Next.

A glyph outline becomes a closed mesh. Each border falls inward: left and top borders are steep, right and bottom borders are shallow, and the bottom of the groove stops at the target depth. The same cut is one mesh per letter. It is not applied to general SVG paths.

`chiselContours(rings, { steepAngle, shallowAngle, targetDepth })` takes y-up rings and returns `{ positions, indices }`. `z` is 0 on the surface and negative in the groove.
