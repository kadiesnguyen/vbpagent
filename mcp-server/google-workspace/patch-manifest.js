const fs = require('fs');
const path = '/usr/local/lib/node_modules/@aaronsb/google-workspace-mcp/build/factory/manifest.yaml';
let yaml = fs.readFileSync(path, 'utf8');

const original = `      updateValues:
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

const patched = original + `
          valueInputOption:
            type: string
            description: "How input data should be interpreted: USER_ENTERED or RAW"
            default: "USER_ENTERED"`;

if (yaml.includes(original) && !yaml.includes('valueInputOption')) {
  fs.writeFileSync(path, yaml.replace(original, patched));
  console.log('Patched manifest.yaml: added valueInputOption to updateValues');
} else if (yaml.includes('valueInputOption')) {
  console.log('Already patched, skipping');
} else {
  console.log('WARNING: manifest.yaml pattern not found, patch skipped');
  process.exit(1);
}
