# Invitation Generator

A local browser-based invitation layout editor for Hebrew/English invitations.

## Run

```powershell
npm install
$env:PORT = "3010"
npm start
```

Open:

```text
http://localhost:3010
```

## What It Does

- Uses `templates/blank.pdf` as the invitation background.
- Lets you drag, resize, and style independent text blocks.
- Saves the base layout to `layout.json`.
- Saves multiple local projects in browser localStorage.
- Generates a single invitation PDF or a two-up letter PDF.

## Key Files

- `src/server.js` - local HTTP server and API routes
- `src/invitation-template.js` - PDF rendering
- `public/` - browser layout editor
- `layout.json` - default layout/template positions
- `templates/` - source PDF templates
- `assets/fonts/` - local font files
