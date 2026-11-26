# Content format

`content/line.md` is the only source of on-screen text. `tools/build-content.mjs` validates it and
writes `js/content.js`. HTML comments (`<!-- -->`) are notes for editors and are dropped.

```
# Line
title: ...            site title
subtitle: ...         one-line description
tagline: ...          kicker on the welcome card
ride_title: ...       name of the tray ride

## Stop: <id>         one per ride stop, in line order (ids are fixed; the drawing code keys on them)
title: ...
cargo: ...            what the tray holds after this stop (the tag above the cart)
cargo_detail: ...     optional second line of the tag
station: <id>         the station section this stop belongs to

### At this stop
markdown              short explanation; restates the station section

## Station: <id>      denester grapes apples crackers cheese inspect-1 lidding inspect-2 outfeed
title: ...
short: ...
markdown body         the design document's station section

## Person: <id>       operator-1 operator-2 technician
title: ...
role: ...
where: ...
markdown body

## Place: <id>        supply-aisle staging rework-1 rework-2 cart-slots dispatch cabinet
title: ...
markdown body

## Section: <id>      about ai-usage how-to-read throughput shift roster
title: ...
markdown body
```

Markdown supported in bodies: paragraphs, `**bold**`, `*italic*`, `` `code` ``, links, nested
bullet and numbered lists, GFM tables, and `###`-`#####` subheadings. `(A)` renders as an assumption
marker. Internal links use the site's routes, for example `[Operator 1](#/person/operator-1)`; the
generator fails on a link to an unknown target, a missing id, or an emoji.
