const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/vendor/exceljs-manifest.json'), 'utf8'));

for (const alias of manifest.aliases) {
  test(`ExcelJS browser XLSX round trip: ${alias}`, async () => {
    let source;
    if (process.env.SPARK_ASSET_BASE_URL) {
      const response = await fetch(new URL(alias, process.env.SPARK_ASSET_BASE_URL));
      assert.equal(response.status, 200);
      source = Buffer.from(await response.arrayBuffer());
    } else {
      source = fs.readFileSync(path.join(root, alias));
    }
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), manifest.sha256);
    // Run the verified, existing UMD bundle as a browser global. No network,
    // document, credentials or application data are supplied to this context.
    const browser = vm.createContext({ setTimeout, clearTimeout, setImmediate, clearImmediate });
    vm.runInContext(source.toString(), browser, { timeout: 10000 });
    assert.equal(typeof browser.ExcelJS.Workbook, 'function');
    // Keep arrays and objects in the same realm as the browser library.
    const result = JSON.parse(await vm.runInContext(`(async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Compatibility');
      sheet.addRow(['Item', 'Amount']);
      sheet.addRow(['Synthetic check', 42]);
      sheet.getCell('B3').value = { formula: 'B2*2', result: 84 };
      sheet.getCell('A1').font = { bold: true };
      sheet.getCell('D1').value = 'Merged heading';
      sheet.mergeCells('D1:E1');
      const bytes = await workbook.xlsx.writeBuffer();
      const restored = new ExcelJS.Workbook();
      await restored.xlsx.load(bytes);
      const result = restored.getWorksheet('Compatibility');
      return JSON.stringify({
        text: result.getCell('A2').value,
        number: result.getCell('B2').value,
        formula: result.getCell('B3').value.formula,
        calculated: result.getCell('B3').value.result,
        bold: result.getCell('A1').font.bold,
        merged: result.getCell('E1').value,
      });
    })()`, browser, { timeout: 10000 }));
    assert.deepEqual(result, {
      text: 'Synthetic check', number: 42, formula: 'B2*2', calculated: 84,
      bold: true, merged: 'Merged heading',
    });
  });
}
