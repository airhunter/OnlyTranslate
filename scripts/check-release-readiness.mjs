#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
let versionArg;
let checkZip = false;

for (const arg of args) {
  if (arg === '--check-zip') {
    checkZip = true;
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (!versionArg) {
    versionArg = arg.replace(/^v/, '');
  } else {
    fail(`未知参数: ${arg}`);
  }
}

const root = process.cwd();
const packageJson = readJson('package.json');
const version = versionArg ?? packageJson.version;

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`版本号格式不正确: ${version}`);
}

const releaseNotes = readReleaseNotes('entrypoints/utils/releaseNotes.ts');
const note = releaseNotes.find((item) => item.version === version);

if (!note) {
  fail(`entrypoints/utils/releaseNotes.ts 缺少 ${version} 的用户版更新说明`);
}

if (releaseNotes[0]?.version !== version) {
  fail(`${version} 的用户版更新说明必须放在 releaseNotes 数组最前面`);
}

if (!note.title.trim()) {
  fail(`${version} 的用户版更新说明缺少 title`);
}

if (note.items.length < 3 || note.items.length > 5) {
  fail(`${version} 的用户版更新说明需要 3-5 条，当前为 ${note.items.length} 条`);
}

for (const [index, item] of note.items.entries()) {
  if (!item.trim()) {
    fail(`${version} 的第 ${index + 1} 条用户版更新说明为空`);
  }
}

const duplicateVersions = findDuplicates(releaseNotes.map((item) => item.version));
if (duplicateVersions.length > 0) {
  fail(`releaseNotes 存在重复版本: ${duplicateVersions.join(', ')}`);
}

const releaseIt = readJson('.release-it.json');
if (releaseIt.github?.release !== true) {
  fail('.release-it.json 需要开启 github.release');
}

const expectedAssetPattern = '.output/OnlyTranslate-v${version}-chrome.zip';
if (!Array.isArray(releaseIt.github.assets) || !releaseIt.github.assets.includes(expectedAssetPattern)) {
  fail(`.release-it.json 需要上传 ${expectedAssetPattern}`);
}

if (releaseIt.hooks?.['before:github:release'] !== 'pnpm zip') {
  fail('.release-it.json 需要在 before:github:release 执行 pnpm zip');
}

const wxtConfig = readText('wxt.config.ts');
if (!wxtConfig.includes("name: 'OnlyTranslate'") || !wxtConfig.includes("artifactTemplate: '{{name}}-v{{version}}-{{browser}}.zip'")) {
  fail('wxt.config.ts 需要配置 OnlyTranslate-v{{version}}-{{browser}}.zip 产物命名');
}

if (checkZip) {
  const expectedZip = path.join(root, `.output/OnlyTranslate-v${version}-chrome.zip`);
  if (!fs.existsSync(expectedZip)) {
    fail(`缺少打包产物: ${path.relative(root, expectedZip)}，请先运行 pnpm zip`);
  }
}

console.log(`release readiness check passed for v${version}`);

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readReleaseNotes(relativePath) {
  const sourceText = readText(relativePath);
  const sourceFile = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);
  const releaseNotesNode = findReleaseNotesArray(sourceFile);

  if (!releaseNotesNode) {
    fail(`${relativePath} 中未找到 releaseNotes 数组`);
  }

  return releaseNotesNode.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) {
      fail(`releaseNotes 第 ${index + 1} 项不是对象`);
    }

    return {
      version: getStringProperty(element, 'version', index),
      title: getStringProperty(element, 'title', index),
      items: getStringArrayProperty(element, 'items', index)
    };
  });
}

function findReleaseNotesArray(sourceFile) {
  let result;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'releaseNotes' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      result = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

function getStringProperty(node, propertyName, index) {
  const property = findProperty(node, propertyName);
  if (!property || !ts.isStringLiteralLike(property.initializer)) {
    fail(`releaseNotes 第 ${index + 1} 项缺少字符串字段 ${propertyName}`);
  }

  return property.initializer.text;
}

function getStringArrayProperty(node, propertyName, index) {
  const property = findProperty(node, propertyName);
  if (!property || !ts.isArrayLiteralExpression(property.initializer)) {
    fail(`releaseNotes 第 ${index + 1} 项缺少数组字段 ${propertyName}`);
  }

  return property.initializer.elements.map((element, itemIndex) => {
    if (!ts.isStringLiteralLike(element)) {
      fail(`releaseNotes 第 ${index + 1} 项的 ${propertyName}[${itemIndex}] 不是字符串`);
    }

    return element.text;
  });
}

function findProperty(node, propertyName) {
  return node.properties.find((property) => {
    if (!ts.isPropertyAssignment(property)) return false;
    const name = property.name;
    return (
      (ts.isIdentifier(name) && name.text === propertyName) ||
      (ts.isStringLiteralLike(name) && name.text === propertyName)
    );
  });
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates];
}

function printHelp() {
  console.log('Usage: pnpm release:check [version] [--check-zip]');
}

function fail(message) {
  console.error(`release readiness check failed: ${message}`);
  process.exit(1);
}
