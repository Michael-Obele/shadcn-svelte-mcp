import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('.mastra/output');

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        await processDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check if the file contains the pattern
    if (content.includes('createRequire(import.meta.url)')) {
      console.log(`[Post-Build] Fixing createRequire in ${path.relative(process.cwd(), filePath)}`);
      
      const fixedContent = content.replaceAll(
        'createRequire(import.meta.url)',
        'createRequire(import.meta.url || "file://")'
      );
      
      await fs.writeFile(filePath, fixedContent, 'utf-8');
    }
  } catch (error) {
    console.error(`[Post-Build] Error processing file ${filePath}:`, error);
  }
}

async function main() {
  console.log('[Post-Build] Starting post-build optimization...');
  try {
    await processDirectory(OUTPUT_DIR);
    console.log('[Post-Build] Post-build optimization finished successfully.');
  } catch (error) {
    console.error('[Post-Build] Error in post-build optimization:', error);
    process.exit(1);
  }
}

main();
