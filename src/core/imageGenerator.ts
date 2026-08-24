import * as fs from 'fs';
import puppeteer, { Browser } from 'puppeteer';
import { getMermaidScriptPath } from './vendorAssets';

export type ImageFormat = 'png' | 'svg' | 'pdf';

interface ImageOptions {
  mermaidCode: string;
  outputPath: string;
  format: ImageFormat;
  backgroundColor?: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser) {
    // Check if browser is still connected; if not, discard stale reference
    if (!browser.isConnected()) {
      browser = null;
    }
  }
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    // Clear reference if the browser disconnects unexpectedly
    browser.on('disconnected', () => {
      browser = null;
    });
  }
  return browser;
}

export async function generateImage(options: ImageOptions): Promise<void> {
  const { mermaidCode, outputPath, format, backgroundColor = '#ffffff' } = options;

  const html = generateHtml(mermaidCode.trim(), backgroundColor);

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    // Limit page memory usage
    await page.setCacheEnabled(false);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Load the locally installed mermaid bundle (no CDN — works offline, T2.4)
    await page.addScriptTag({ path: getMermaidScriptPath() });
    await page.evaluate(() => {
      const m = (
        globalThis as unknown as {
          mermaid: {
            initialize(opts: Record<string, unknown>): void;
            run(opts: Record<string, unknown>): Promise<void>;
          };
        }
      ).mermaid;
      m.initialize({
        startOnLoad: false,
        er: {
          useMaxWidth: false,
          layoutDirection: 'TB',
          minEntityWidth: 100,
        },
        theme: 'default',
      });
      return m.run({ querySelector: '.mermaid' });
    });

    // Wait for Mermaid to render
    await page.waitForSelector('svg', { timeout: 30000 });

    if (format === 'png') {
      const element = await page.$('svg');
      if (!element) throw new Error('Failed to render diagram');

      const clip = await element.boundingBox();
      if (!clip) throw new Error('Failed to get diagram dimensions');

      await page.setViewport({
        width: Math.ceil(clip.width) + 40,
        height: Math.ceil(clip.height) + 40,
        deviceScaleFactor: 2,
      });

      const screenshot = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: clip.width + 40,
          height: clip.height + 40,
        },
      });

      fs.writeFileSync(outputPath, screenshot);
    } else if (format === 'svg') {
      // Use a simpler approach - get the HTML content
      const content = await page.content();
      const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/);
      if (!svgMatch) throw new Error('Failed to extract SVG');

      fs.writeFileSync(outputPath, svgMatch[0]);
    } else if (format === 'pdf') {
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      fs.writeFileSync(outputPath, pdf);
    }

    console.log(`Image saved to ${outputPath}`);
  } finally {
    await page.close();
  }
}

/** Escapes text for embedding as raw text inside an HTML element. */
function escapeHtmlTextLocal(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateHtml(mermaidCode: string, backgroundColor: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 20px;
      background-color: ${backgroundColor};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    #container {
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="container">
    <div class="mermaid">
${escapeHtmlTextLocal(mermaidCode)
  .split('\n')
  .map((line) => '      ' + line)
  .join('\n')}
    </div>
  </div>
</body>
</html>
  `;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
