#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch (firstError) {
    const modulesRoot = process.env.CODEX_WORKSPACE_NODE_MODULES;
    if (!modulesRoot) {
      throw new Error('Playwright was not found. Set CODEX_WORKSPACE_NODE_MODULES from codex_app__load_workspace_dependencies.');
    }
    try {
      return require(path.join(modulesRoot, 'playwright'));
    } catch {
      throw firstError;
    }
  }
}

function safeName(value) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) throw new Error(`Unsafe capture name: ${value}`);
  return value;
}

const args = parseArgs(process.argv.slice(2));
if (!args.config) {
  console.error('Usage: capture_visual_state.mjs --config /absolute/path/config.json');
  process.exit(2);
}

const configPath = path.resolve(args.config);
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const configDir = path.dirname(configPath);
const outputDir = path.resolve(configDir, config.outputDir ?? 'captures');
const captures = config.captures?.length ? config.captures : [{ name: 'baseline' }];
const setupSource = config.setupScript
  ? await fs.readFile(path.resolve(configDir, config.setupScript), 'utf8')
  : '';

await fs.mkdir(outputDir, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const page = await browser.newPage({
    viewport: config.viewport ?? { width: 1400, height: 900 },
    deviceScaleFactor: config.deviceScaleFactor ?? 1,
  });

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  const response = await page.goto(config.url ?? 'http://127.0.0.1:5173/', {
    waitUntil: 'domcontentloaded',
  });
  if (!response?.ok()) throw new Error(`Navigation failed with HTTP ${response?.status() ?? 'unknown'}`);

  const enterSelector = config.enterSelector ?? '#btn-enter';
  const enter = page.locator(enterSelector);
  if (await enter.count() && await enter.isVisible()) await enter.click();
  await page.waitForTimeout(config.waitAfterEnterMs ?? 500);

  if (setupSource) {
    await page.evaluate(source => {
      const game = window.game;
      if (!game) throw new Error('window.game is unavailable');
      Function('game', source)(game);
    }, setupSource);
  }

  if (config.freeze !== false) {
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0;
      const game = window.game;
      if (game?.sim) {
        game.sim.paused = true;
        game.sim.speed = 0;
      }
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      const game = window.game;
      const profiles = ['standardMaterials', 'softToonMaterials', 'toonMaterials'];
      for (const profile of profiles) {
        for (const material of Object.values(game.assets?.[profile] ?? {})) {
          if (material?.userData?.uTime) material.userData.uTime.value = 0;
        }
      }
      game.renderer?.composer?.render();
    });
  }

  const hideSelectors = config.hideSelectors ?? ['#loader', '#hud-layer'];
  await page.evaluate(selectors => {
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(element => {
        element.dataset.visualProbeDisplay = element.style.display;
        element.style.display = 'none';
      });
    }
  }, hideSelectors);

  await page.evaluate(() => {
    const game = window.game;
    const scene = game.renderer.scene;
    window.__nabocityVisualProbe = {
      visibility: new Map(scene.children.flatMap(function collect(node) {
        return [[node, node.visible], ...node.children.flatMap(collect)];
      })),
      background: scene.background?.clone?.() ?? scene.background,
      fog: scene.fog,
    };
  });

  for (const capture of captures) {
    const name = safeName(capture.name ?? 'capture');
    const result = await page.evaluate(options => {
      const game = window.game;
      const scene = game.renderer.scene;
      const base = window.__nabocityVisualProbe;
      for (const [node, visible] of base.visibility) node.visible = visible;
      scene.background = base.background?.clone?.() ?? base.background;
      scene.fog = base.fog;

      const resolveMaterials = keys => {
        const materials = new Set();
        const missing = [];
        for (const key of keys ?? []) {
          const material = game.assets.materials[key];
          if (material) materials.add(material);
          else missing.push(key);
        }
        if (missing.length) throw new Error(`Unknown active-profile materials: ${missing.join(', ')}`);
        return materials;
      };

      const showOnly = resolveMaterials(options.showOnlyMaterials);
      const hide = resolveMaterials(options.hideMaterials);
      let matched = 0;
      scene.traverse(node => {
        if (!node.isMesh && !node.isInstancedMesh) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        if (showOnly.size) {
          node.visible = materials.some(material => showOnly.has(material));
          if (node.visible) matched += 1;
        } else if (materials.some(material => hide.has(material))) {
          node.visible = false;
          matched += 1;
        }
      });

      if (options.background !== undefined) {
        if (scene.background?.set) scene.background.set(options.background);
        else scene.background = null;
      }
      if (options.fog === false) scene.fog = null;
      game.renderer.composer.render();
      return { matched };
    }, capture);

    const captureSelectors = [...hideSelectors, ...(capture.hideSelectors ?? [])];
    await page.evaluate(selectors => {
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(element => { element.style.display = 'none'; });
      }
    }, captureSelectors);

    const outputPath = path.join(outputDir, `${name}.png`);
    const target = capture.selector ? page.locator(capture.selector) : page;
    await target.screenshot({ path: outputPath });
    console.log(JSON.stringify({ capture: name, output: outputPath, matchedMeshes: result.matched }));
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    if (config.failOnConsoleError !== false) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
