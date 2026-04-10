---
name: google-workspace
description: Use this skill whenever the user asks to do anything with Google Sheets, Google Drive, Gmail, or Google Docs — including creating files, writing data, reading spreadsheets, sending emails, renaming files/tabs, or any Google Workspace operation. Always follow the exact tool sequences below.
---

# Google Workspace Operations Guide

## Prerequisites

Before using any Google Workspace tool, verify that the agent has Google accounts configured (`google_emails` in agent settings). The system prompt will list available accounts. Always pass the correct email to every tool call.

---

## Google Sheets — Full Workflow

### Creating a spreadsheet with correct name, tab name, and data

Always follow this exact sequence:

**Step 1 — Create the spreadsheet**
```
manage_sheets(operation="create", email="user@gmail.com")
→ returns: spreadsheetId
```

**Step 2 — Rename the file in Drive**
```
manage_drive(operation="rename", email="user@gmail.com", fileId=<spreadsheetId>, name="<desired filename>")
```

**Step 3 — Rename the first sheet tab**
```
manage_sheets(
  operation="renameSheet",
  email="user@gmail.com",
  spreadsheetId=<spreadsheetId>,
  jsonBody='{"requests":[{"updateSheetProperties":{"properties":{"sheetId":0,"title":"<tab name>"},"fields":"title"}}]}'
)
```
Note: `sheetId: 0` is always the first tab. To rename other tabs, call `get` first to find their sheetId.

**Step 4 — Write data**
```
manage_sheets(
  operation="updateValues",
  email="user@gmail.com",
  spreadsheetId=<spreadsheetId>,
  range="<tab name>!A1",
  jsonValues='[["Col1","Col2"],["val1","val2"],["val3","val4"]]'
)
```
- `range` must use the ACTUAL tab name from step 3 (never assume "Sheet1")
- `jsonValues` is a JSON array of arrays (rows × columns)

**Step 5 — Return the link**

Always share the direct link after any file creation or modification:
- Sheets: `https://docs.google.com/spreadsheets/d/<spreadsheetId>/edit`
- Docs: `https://docs.google.com/document/d/<fileId>/edit`
- Slides: `https://docs.google.com/presentation/d/<fileId>/edit`
- Other: `https://drive.google.com/file/d/<fileId>/view`

---

### Reading a spreadsheet

**Get metadata (sheet names, IDs)**
```
manage_sheets(operation="get", email="user@gmail.com", spreadsheetId=<id>)
```

**Read a range**
```
manage_sheets(operation="read", email="user@gmail.com", spreadsheetId=<id>, range="<tab>!A1:Z100")
```
Always use `get` first to confirm the real tab name before reading.

---

## Google Sheets — Cell Formatting

Use `formatCells` after writing data. All formatting uses `spreadsheets.batchUpdate` via `jsonBody`.

**sheetId**: always 0 for the first tab. Call `get` to find sheetId for other tabs.

### Freeze header row
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[{"updateSheetProperties":{"properties":{"sheetId":0,"gridProperties":{"frozenRowCount":1}},"fields":"gridProperties.frozenRowCount"}}]}'
)
```

### Bold + background color on header row (row 1 = startRowIndex 0, endRowIndex 1)
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[{"repeatCell":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":1},"cell":{"userEnteredFormat":{"backgroundColor":{"red":0.26,"green":0.52,"blue":0.96},"textFormat":{"bold":true,"foregroundColor":{"red":1,"green":1,"blue":1}},"horizontalAlignment":"CENTER"}},"fields":"userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"}}]}'
)
```

### Center-align a range (e.g. all data rows)
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[{"repeatCell":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":100,"startColumnIndex":0,"endColumnIndex":5},"cell":{"userEnteredFormat":{"horizontalAlignment":"CENTER"}},"fields":"userEnteredFormat.horizontalAlignment"}}]}'
)
```

### Add borders to a range
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[{"updateBorders":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":10,"startColumnIndex":0,"endColumnIndex":3},"top":{"style":"SOLID","width":1},"bottom":{"style":"SOLID","width":1},"left":{"style":"SOLID","width":1},"right":{"style":"SOLID","width":1},"innerHorizontal":{"style":"SOLID","width":1},"innerVertical":{"style":"SOLID","width":1}}}]}'
)
```

### Merge cells (e.g. merge A1:C1 as title)
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[{"mergeCells":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":1,"startColumnIndex":0,"endColumnIndex":3},"mergeType":"MERGE_ALL"}}]}'
)
```

### Combine multiple formatting requests in one call
```
manage_sheets(
  operation="formatCells",
  email="user@gmail.com",
  spreadsheetId=<id>,
  jsonBody='{"requests":[
    {"updateSheetProperties":{"properties":{"sheetId":0,"gridProperties":{"frozenRowCount":1}},"fields":"gridProperties.frozenRowCount"}},
    {"repeatCell":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":1},"cell":{"userEnteredFormat":{"backgroundColor":{"red":0.26,"green":0.52,"blue":0.96},"textFormat":{"bold":true,"foregroundColor":{"red":1,"green":1,"blue":1}}}},"fields":"userEnteredFormat(backgroundColor,textFormat)"}},
    {"updateBorders":{"range":{"sheetId":0,"startRowIndex":0,"endRowIndex":10,"startColumnIndex":0,"endColumnIndex":2},"top":{"style":"SOLID"},"bottom":{"style":"SOLID"},"left":{"style":"SOLID"},"right":{"style":"SOLID"},"innerHorizontal":{"style":"SOLID"},"innerVertical":{"style":"SOLID"}}}
  ]}'
)
```

**Color reference (red/green/blue as 0.0–1.0):**
- Blue header: `{"red":0.26,"green":0.52,"blue":0.96}`
- Green: `{"red":0.18,"green":0.62,"blue":0.18}`
- Yellow: `{"red":1.0,"green":0.9,"blue":0.0}`
- Gray: `{"red":0.85,"green":0.85,"blue":0.85}`
- White text: `{"red":1,"green":1,"blue":1}`

---

## Google Drive — File Operations

### Search files
```
manage_drive(operation="search", email="user@gmail.com", query="name contains 'report' and trashed=false", maxResults=10)
```

### Rename a file
```
manage_drive(operation="rename", email="user@gmail.com", fileId=<id>, name="New Name")
```

### Copy a file
```
manage_drive(operation="copy", email="user@gmail.com", fileId=<id>, name="Copy Name")
→ returns new fileId
```

### Delete a file
```
manage_drive(operation="delete", email="user@gmail.com", fileId=<id>)
```

---

## Gmail

### Send an email
```
manage_gmail(operation="send", email="user@gmail.com", to="recipient@example.com", subject="Subject", body="Body text")
```

### Search emails
```
manage_gmail(operation="search", email="user@gmail.com", query="is:unread from:boss@company.com", maxResults=10)
```

### Read an email
```
manage_gmail(operation="get", email="user@gmail.com", messageId=<id>)
```

---

## Common Mistakes to Avoid

| Wrong | Correct |
|-------|---------|
| Assume tab name is "Sheet1" | Call `get` to check actual tab name, or use the name you just set in renameSheet |
| Skip renaming after create | Always rename file (Drive) and tab (Sheets) immediately after create |
| Use `copy` to create named files | Use `create` then `rename` — copy inherits "Bản sao của..." prefix |
| Forget to return the link | Always end with the full clickable URL |
| Pass `jsonValues` without `range` | Both are required for updateValues |
