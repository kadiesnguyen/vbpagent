const fs = require('fs');

// ─── Patch 1: manifest.yaml ───────────────────────────────────────────────────
// Add valueInputOption + jsonValues (with body:true marker) to updateValues.
// The Google Sheets API requires:
//   - valueInputOption as a query param
//   - the cell values in the request body as {"values": [[...], [...]]}
// ─────────────────────────────────────────────────────────────────────────────
const manifestPath = '/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/build/factory/manifest.yaml';
let yaml = fs.readFileSync(manifestPath, 'utf8');

const originalManifest = `      updateValues:
        type: action
        description: "write values to a specific range"
        resource: spreadsheets.values.update
        params:
          spreadsheetId:
            type: string
            description: "Spreadsheet ID"
            required: true
          range:
            type: string
            description: "A1 notation range to write to"
            required: true`;

const patchedManifest = originalManifest + `
          valueInputOption:
            type: string
            description: "How input data should be interpreted: USER_ENTERED or RAW"
            default: "USER_ENTERED"
          jsonValues:
            type: string
            description: JSON array of rows to write, e.g. Header1,Header2 on first row then data rows
            required: true
            body: true
            body_wrap: "values"`;

if (yaml.includes(originalManifest) && !yaml.includes('body_wrap')) {
  fs.writeFileSync(manifestPath, yaml.replace(originalManifest, patchedManifest));
  console.log('Patched manifest.yaml: added valueInputOption + jsonValues(body) to updateValues');
} else if (yaml.includes('body_wrap')) {
  console.log('manifest.yaml already patched, skipping');
} else {
  console.log('WARNING: manifest.yaml pattern not found, patch skipped');
  process.exit(1);
}

// ─── Patch 2: generator.js ───────────────────────────────────────────────────
// buildResourceArgs only builds --params. We extend it to also build --json
// for params marked with body:true. If body_wrap is set, the value is wrapped
// in an object: body_wrap key → parsed JSON value.
// e.g. jsonValues='[["a","b"]]' with body_wrap="values"
//   → --json '{"values":[["a","b"]]}'
// ─────────────────────────────────────────────────────────────────────────────
const generatorPath = '/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/build/factory/generator.js';
let gen = fs.readFileSync(generatorPath, 'utf8');

const originalGen = `    if (Object.keys(gwsParams).length > 0) {
        args.push('--params', JSON.stringify(gwsParams));
    }
    return args;
}`;

const patchedGen = `    if (Object.keys(gwsParams).length > 0) {
        args.push('--params', JSON.stringify(gwsParams));
    }
    // Body params (body:true in manifest) go to --json instead of --params.
    if (opDef.params) {
        const bodyObj = {};
        for (const [paramName, paramDef] of Object.entries(opDef.params)) {
            if (!paramDef.body) continue;
            const value = params[paramName];
            if (value === undefined || value === null || value === '') continue;
            let parsed;
            try { parsed = JSON.parse(value); } catch { parsed = value; }
            if (paramDef.body_wrap) {
                bodyObj[paramDef.body_wrap] = parsed;
            } else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                // Plain object (e.g. jsonBody) — merge directly into body
                Object.assign(bodyObj, parsed);
            } else {
                bodyObj[paramName] = parsed;
            }
        }
        if (Object.keys(bodyObj).length > 0) {
            args.push('--json', JSON.stringify(bodyObj));
        }
    }
    return args;
}`;

if (gen.includes(originalGen) && !gen.includes('body_wrap')) {
  let patched = gen.replace(originalGen, patchedGen);
  // Also skip body:true params in the --params building loop so they don't
  // end up in both --params and --json. Patch the loop to add `if (paramDef.body) continue;`
  const loopOrig = `for (const [paramName, paramDef] of Object.entries(opDef.params)) {
            const value = params[paramName];`;
  const loopPatched = `for (const [paramName, paramDef] of Object.entries(opDef.params)) {
            if (paramDef.body) continue; // body params go to --json only
            const value = params[paramName];`;
  if (patched.includes(loopOrig)) {
    patched = patched.replace(loopOrig, loopPatched);
  }
  fs.writeFileSync(generatorPath, patched);
  console.log('Patched generator.js: buildResourceArgs now supports body params (--json)');
} else if (gen.includes('body_wrap')) {
  console.log('generator.js already patched, skipping');
} else {
  console.log('WARNING: generator.js pattern not found, patch skipped');
  process.exit(1);
}

// ─── Patch 5: defaults.js – formatDefaultAction returns spreadsheetId ─────────
// Google Sheets API returns spreadsheetId (not id). Without this patch the bot
// sees "Operation completed." with no ID and hallucinates a fileId for rename.
// ─────────────────────────────────────────────────────────────────────────────
const defaultsPath = '/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/build/factory/defaults.js';
let defaults = fs.readFileSync(defaultsPath, 'utf8');

const originalDefaults = `function formatDefaultAction(data) {
    const obj = (data ?? {});
    const id = String(obj.id ?? 'unknown');
    const parts = ['Operation completed.'];
    if (obj.id)
        parts.push(\`\\n**ID:** \${id}\`);
    return {
        text: parts.join(''),
        refs: { id, ...extractScalarRefs(obj) },
    };
}`;

const patchedDefaults = `function formatDefaultAction(data) {
    const obj = (data ?? {});
    // Google Sheets returns spreadsheetId; Drive returns id or fileId; Docs returns documentId
    const id = String(obj.documentId ?? obj.spreadsheetId ?? obj.id ?? obj.fileId ?? 'unknown');
    const parts = ['Operation completed.'];
    if (obj.documentId || obj.spreadsheetId || obj.id || obj.fileId)
        parts.push(\`\\n**ID:** \\\`\${id}\\\`\`);
    if (obj.spreadsheetUrl)
        parts.push(\`\\n**URL:** \${obj.spreadsheetUrl}\`);
    return {
        text: parts.join(''),
        refs: { id, ...extractScalarRefs(obj) },
    };
}`;

if (defaults.includes(originalDefaults) && !defaults.includes('spreadsheetId')) {
  fs.writeFileSync(defaultsPath, defaults.replace(originalDefaults, patchedDefaults));
  console.log('Patched defaults.js: formatDefaultAction now returns documentId/spreadsheetId/fileId');
} else if (defaults.includes('documentId')) {
  console.log('defaults.js already patched with documentId, skipping');
} else if (defaults.includes('spreadsheetId')) {
  // Old patch — re-apply with documentId support
  fs.writeFileSync(defaultsPath, defaults.replace(/function formatDefaultAction[\s\S]*?^}/m, patchedDefaults));
  console.log('Patched defaults.js: upgraded to include documentId');
} else {
  console.log('WARNING: defaults.js pattern not found, patch skipped');
  process.exit(1);
}

// ─── Patch 3: manifest.yaml – add renameFile to drive ────────────────────────
// Drive has no rename op. Uses files.update with fileId in --params and
// {"name":"..."} in --json body.
// ─────────────────────────────────────────────────────────────────────────────
yaml = fs.readFileSync(manifestPath, 'utf8'); // re-read after patch 1

const driveDeleteBlock = `      delete:
        type: action
        description: "permanently delete a file (cannot be undone)"
        resource: files.delete
        params:
          fileId:
            type: string
            description: "File ID to delete"
            required: true`;

const driveDeletePatched = `      rename:
        type: action
        description: "rename a file or folder in Google Drive"
        resource: files.update
        params:
          fileId:
            type: string
            description: "File ID to rename"
            required: true
          name:
            type: string
            description: "New name for the file"
            required: true
            body: true

` + driveDeleteBlock;

if (!yaml.includes('rename a file or folder')) {
  fs.writeFileSync(manifestPath, yaml.replace(driveDeleteBlock, driveDeletePatched));
  console.log('Patched manifest.yaml: added rename operation to drive');
} else {
  console.log('manifest.yaml drive rename already patched, skipping');
}

// ─── Patch 4: manifest.yaml – add renameSheet to sheets ──────────────────────
// Sheets has no tab-rename op. Uses spreadsheets.batchUpdate with a
// updateSheetProperties request. sheetId defaults to 0 (first tab).
// ─────────────────────────────────────────────────────────────────────────────
yaml = fs.readFileSync(manifestPath, 'utf8'); // re-read after patch 3

const sheetsGetValuesBlock = `      getValues:
        type: detail
        description: "get values from a specific range (raw API)"`;

const sheetsGetValuesPatched = `      renameSheet:
        type: action
        description: "rename a sheet tab inside a spreadsheet"
        resource: spreadsheets.batchUpdate
        params:
          spreadsheetId:
            type: string
            description: "Spreadsheet ID"
            required: true
          jsonBody:
            type: string
            description: 'Full batchUpdate request body as JSON string. Example to rename first tab to Banggia: {"requests":[{"updateSheetProperties":{"properties":{"sheetId":0,"title":"Banggia"},"fields":"title"}}]}'
            required: true
            body: true

` + sheetsGetValuesBlock;

if (!yaml.includes('rename a sheet tab')) {
  fs.writeFileSync(manifestPath, yaml.replace(sheetsGetValuesBlock, sheetsGetValuesPatched));
  console.log('Patched manifest.yaml: added renameSheet operation to sheets');
} else {
  console.log('manifest.yaml renameSheet already patched, skipping');
}

// ─── Patch 5b: manifest.yaml – add formatCells to sheets ─────────────────────
// Exposes spreadsheets.batchUpdate for cell formatting: backgroundColor,
// textFormat (bold/italic), horizontalAlignment, borders, freeze rows, merge.
// The agent passes a jsonBody with the full requests array.
// ─────────────────────────────────────────────────────────────────────────────
yaml = fs.readFileSync(manifestPath, 'utf8');

const sheetsUpdateValuesBlock = `      updateValues:`;

const sheetsFormatPatch = `      formatCells:
        type: action
        description: "format cells in a spreadsheet: set background color, bold/italic text, alignment, borders, freeze rows, or merge cells. Uses spreadsheets.batchUpdate."
        resource: spreadsheets.batchUpdate
        params:
          spreadsheetId:
            type: string
            description: "Spreadsheet ID"
            required: true
          jsonBody:
            type: string
            description: 'Full batchUpdate requests array as JSON. Use sheetId 0 for first tab. Common requests: repeatCell (color/bold/align), updateBorders, mergeCells, updateSheetProperties (freeze rows).'
            required: true
            body: true

` + sheetsUpdateValuesBlock;

if (!yaml.includes('format cells in a spreadsheet')) {
  fs.writeFileSync(manifestPath, yaml.replace(sheetsUpdateValuesBlock, sheetsFormatPatch));
  console.log('Patched manifest.yaml: added formatCells operation to sheets');
} else {
  console.log('manifest.yaml formatCells already patched, skipping');
}

// ─── Patch 6: server.js – disable token warmup in stateless mode ─────────────
// In streamableHttp stateless mode, each request spawns a fresh child process.
// Token warmup (prefetching OAuth tokens for all 14 accounts) runs on every
// child start, creating 14+ concurrent HTTP connections per child. With multiple
// concurrent children (health checks, tool calls, SSE streams), memory grows to
// OOM. Warmup is also pointless in stateless mode: the next request gets a new
// child and warms again anyway. Disable it via GWS_SKIP_WARMUP env var.
// ─────────────────────────────────────────────────────────────────────────────
const serverPath = '/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/build/server/server.js';
let server = fs.readFileSync(serverPath, 'utf8');

const originalWarmup = `    // Non-blocking warmup — don't delay MCP handshake
    warmupAccounts().catch(() => { });`;

const patchedWarmup = `    // Non-blocking warmup — disabled in stateless mode (GWS_SKIP_WARMUP=1)
    // to prevent OOM: each child warms tokens for all accounts on startup.
    if (!process.env.GWS_SKIP_WARMUP) {
        warmupAccounts().catch(() => { });
    }`;

if (server.includes(originalWarmup) && !server.includes('GWS_SKIP_WARMUP')) {
  fs.writeFileSync(serverPath, server.replace(originalWarmup, patchedWarmup));
  console.log('Patched server.js: token warmup gated on GWS_SKIP_WARMUP env var');
} else if (server.includes('GWS_SKIP_WARMUP')) {
  console.log('server.js already patched, skipping');
} else {
  console.log('WARNING: server.js warmup pattern not found, patch skipped');
  process.exit(1);
}
