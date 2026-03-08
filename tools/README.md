# Default Office — Creative Tools

Internal tool suite for Default Office.  
Live at [tools.defaultoffice.com](https://tools.defaultoffice.com)

## Adding a new tool

1. Create a folder in `/tools/` with a short lowercase hyphenated name
2. Add `index.html` (self-contained tool) and `thumbnail.png` (16:9 screenshot)
3. Add an entry to `/tools/registry.json`
4. Push to main — Vercel auto-deploys

## Registry format

Each tool needs an entry in `/tools/registry.json`:

```json
{
    "folder": "folder-name",
    "name": "Display Name",
    "category": "Category",
    "project": "Client or Project",
    "owner": "Alex",
    "date": "DD.MM.YYYY"
}
```

## Structure

```
index.html              ← landing page (auto-reads registry)
logo.svg
fonts/
  SuisseIntl-Regular.otf
  SuisseIntl-Medium.otf
  SuisseIntl-Light.otf
tools/
  registry.json         ← tool listing
  example-tool/
    index.html
    thumbnail.png
```
