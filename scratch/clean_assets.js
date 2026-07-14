import * as fs from 'fs';

const file = 'src/game/AssetGenerator.ts';
let code = fs.readFileSync(file, 'utf8');

const marker = '  // Helper to get seeds/palette/foundation for cottage variations';
const markerIndex = code.indexOf(marker);

const endMarker = '// Simple Helper for material animations';
const endIndex = code.indexOf(endMarker);

if (markerIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, markerIndex);
  const after = code.substring(endIndex);
  // Write class closing brace, then helper functions
  fs.writeFileSync(file, before + '}\n\n' + after, 'utf8');
  console.log('Cleaned AssetGenerator.ts successfully!');
} else {
  console.log('Error: Could not locate cleanup markers in AssetGenerator.ts');
}
