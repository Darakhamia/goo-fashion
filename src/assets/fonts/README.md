# Inter Tight, for cards drawn on the server

The card export (`src/lib/server/card-image.ts`) draws the brand, the name and
the price into the exported picture itself, so it needs the site's typeface as a
file — `next/font` only ever delivers it to a browser.

These are the static Google Fonts builds of Inter Tight in the three weights the
cards use: 400 for a piece's name, 500 for its price, 600 for the brand. They are
committed rather than fetched because the route that draws cards must not depend
on Google being reachable at request time, and a serverless host carries no fonts
of its own — without these the type would silently not render at all.

Licensed under the SIL Open Font License 1.1 (`OFL.txt`), which permits
redistribution alongside our own code.

To refresh them, take the URLs Google serves for
`https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600` and keep
the file names as they are — `card-image.ts` looks them up by name.
