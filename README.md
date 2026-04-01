# Default Office — Creative Tools

Internal tool suite for Default Office.
Live at [tools.defaultoffice.com](https://tools.defaultoffice.com)

## Adding a new tool

1. Drop a folder into `/tools/` containing three files:
   - `index.html` — the tool
   - `meta.json` — tool metadata
   - `thumbnail.png` — 16:9 screenshot
2. Push to GitHub — done

## meta.json format

```json
{
    "name": "Display Name",
    "category": "Category",
    "project": "Client or Project",
    "owner": "Alex",
    "date": "DD.MM.YYYY"
}
```

## Structure

```
index.html              ← landing page
logo.svg
build.js                ← auto-generates registry at deploy
vercel.json             ← build config
fonts/
  SuisseIntl-Regular.otf
  SuisseIntl-Medium.otf
  SuisseIntl-Light.otf
tools/
  wave-mesh/
    index.html
    meta.json
    thumbnail.png
```
