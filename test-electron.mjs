console.log('Running ESM test script');
console.log('Process versions:', process.versions);

import electron from 'electron';
console.log('Electron default import type:', typeof electron);
console.log('Electron default import value:', electron);

if (typeof electron === 'string') {
    console.log('CRITICAL: Electron imported as string (path). This is the npm package, not the internal module.');
} else {
    console.log('Electron imported as object. Keys:', Object.keys(electron));
    if (electron.app) {
        console.log('App found!');
        electron.app.quit();
    }
}
