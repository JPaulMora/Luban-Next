const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName !== 'darwin') {
        return;
    }

    const teamId = process.env.TEAMID;
    const appleId = process.env.APPLEID;
    const appleIdPassword = process.env.APPLEIDPASS;

    if (!teamId || !appleId || !appleIdPassword) {
        return;
    }

    console.log('Notarizing application...');

    const appName = context.packager.appInfo.productFilename;

    await notarize({
        appPath: `${appOutDir}/${appName}.app`,
        appleId,
        appleIdPassword,
        teamId,
    });
};
