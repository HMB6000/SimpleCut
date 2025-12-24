const electron = require('electron');
console.log('Process versions:', process.versions);
console.log('Electron loaded type:', typeof electron);
console.log('Electron loaded value:', electron);

if (process.versions.electron) {
    console.log('Running in Electron version:', process.versions.electron);
} else {
    console.log('Running in Node.js (not Electron)');
}

if (typeof electron === 'object') {
    console.log('App available:', !!electron.app);
    if (electron.app) {
        console.log('Quitting app...');
        electron.app.quit();
    }
}
