const fs = require('fs');
const path = require('path');

const distRoot = path.join(process.cwd(), '.test-dist');
const obsidianDir = path.join(distRoot, 'node_modules', 'obsidian');
fs.mkdirSync(obsidianDir, { recursive: true });
fs.writeFileSync(path.join(distRoot, 'package.json'), '{"type":"commonjs"}');
fs.writeFileSync(
	path.join(obsidianDir, 'index.js'),
	`function normalizePath(value) {
  let output = String(value).split("\\\\").join("/");
  while (output.includes("//")) output = output.split("//").join("/");
  if (output.startsWith("./")) output = output.slice(2);
  return output;
}

class PluginSettingTab {}
class Setting {
  setName() { return this; }
  setDesc() { return this; }
  setClass() { return this; }
  setDisabled() { return this; }
  addButton(cb) { cb({ setButtonText() { return this; }, onClick() { return this; } }); return this; }
  addToggle(cb) { cb({ setValue() { return this; }, onChange() { return this; } }); return this; }
  addText(cb) { cb({ setPlaceholder() { return this; }, setValue() { return this; }, onChange() { return this; } }); return this; }
  addTextArea(cb) { cb({ setValue() { return this; }, onChange() { return this; }, inputEl: { rows: 0, classList: { add() {} } } }); return this; }
}
class Modal {}
class Notice {}
class Plugin {}

module.exports = {
  normalizePath,
  PluginSettingTab,
  Setting,
  Modal,
  Notice,
  Plugin,
  TFile: class TFile { constructor(path) { this.path = path; } },
  requestUrl: async () => { throw new Error("requestUrl stub called in tests"); }
};\n`,
);
