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
            description: "JSON array of rows to write (e.g. '[[\"Header1\",\"Header2\"],[\"val1\",\"val2\"]]')"
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
  fs.writeFileSync(generatorPath, gen.replace(originalGen, patchedGen));
  console.log('Patched generator.js: buildResourceArgs now supports body params (--json)');
} else if (gen.includes('body_wrap')) {
  console.log('generator.js already patched, skipping');
} else {
  console.log('WARNING: generator.js pattern not found, patch skipped');
  process.exit(1);
}

// ─── Patch 3: manifest.yaml – add renameFile to drive ────────────────────────
// Drive has no rename op. Uses files.update with fileId in --params and
// {"name":"..."} in --json body.
// ─────────────────────────────────────────────────────────────────────────────
yaml = fs.readFileSync(manifestPath, 'utf8'); // re-read after patch 1

const driveDeleteBlock = `      delete:
        type: action
        description: "permanently delete a file"
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
            description: "Full batchUpdate body JSON. For renaming tab with sheetId=0 to 'Banggia': '{\"requests\":[{\"updateSheetProperties\":{\"properties\":{\"sheetId\":0,\"title\":\"Banggia\"},\"fields\":\"title\"}}]}'"
            required: true
            body: true

      ` + sheetsGetValuesBlock;

if (!yaml.includes('rename a sheet tab')) {
  // renameSheet uses nested body fields — handle via custom body construction
  // We'll use the simpler approach: mark all body fields and build manually
  fs.writeFileSync(manifestPath, yaml.replace(sheetsGetValuesBlock, sheetsGetValuesPatched));
  console.log('Patched manifest.yaml: added renameSheet operation to sheets');
} else {
  console.log('manifest.yaml renameSheet already patched, skipping');
}
