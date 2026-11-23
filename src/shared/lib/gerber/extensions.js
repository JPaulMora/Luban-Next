// Copper and outline suffixes written by KiCad, Fritzing, and older CAM tools.
const GERBER_EXTENSIONS = [
    '.gbr',
    '.ger',
    '.gerber',
    '.gtl',
    '.gbl',
    '.gko',
    '.gm1',
    '.gto',
    '.gbo',
    '.gtp',
    '.gbp',
    '.gts',
    '.gbs',
    '.pho',
];

const isGerberFilename = (filename) => {
    if (!filename) {
        return false;
    }
    const dot = String(filename).lastIndexOf('.');
    if (dot < 0) {
        return false;
    }
    return GERBER_EXTENSIONS.indexOf(String(filename).slice(dot).toLowerCase()) !== -1;
};

const gerberAcceptList = () => GERBER_EXTENSIONS.join(', ');

export {
    GERBER_EXTENSIONS,
    isGerberFilename,
    gerberAcceptList,
};
