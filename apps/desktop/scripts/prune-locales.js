const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const electronFrameworkPath = path.join(
    context.appOutDir,
    'Crunch.app',
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'A',
    'Resources'
  );

  if (!fs.existsSync(electronFrameworkPath)) {
    console.log('  → Electron Framework Resources not found, skipping locale pruning.');
    return;
  }

  const localesToKeep = ['en.lproj', 'tr.lproj', 'en_GB.lproj'];
  const files = fs.readdirSync(electronFrameworkPath);

  let prunedCount = 0;
  for (const file of files) {
    if (file.endsWith('.lproj') && !localesToKeep.includes(file)) {
      const fullPath = path.join(electronFrameworkPath, file);
      fs.rmSync(fullPath, { recursive: true, force: true });
      prunedCount++;
    }
  }

  console.log(`  → Pruned ${prunedCount} unnecessary locales from Electron Framework.`);
};
