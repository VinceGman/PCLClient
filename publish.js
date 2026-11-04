
const { execSync } = require('child_process');
const https = require('https');

const token = process.env.GH_TOKEN;
if (!token) throw new Error('GH_TOKEN missing from .env');

const auth = Buffer.from(`x-access-token:${token}`).toString('base64');

const env = {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`
};

function checkRelease(tag) {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'api.github.com',
            path: `/repos/VinceGman/PCLClient/releases/tags/${tag}`,
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'PCLClient'
            }
        }, res => {
            res.resume();
            resolve(res.statusCode === 200);
        }).on('error', reject);
    });
}

async function publish() {
    const packagePath = require.resolve('./package.json');

    while (true) {
        const version = require(packagePath).version;
        const tag = `v${version}`;

        if (await checkRelease(tag)) {
            console.log(`${tag} already exists. Incrementing version...`);
            execSync('npm version patch', { stdio: 'inherit' });
            delete require.cache[packagePath];
            continue;
        }

        break;
    }

    const version = require('./package.json').version;
    const tag = `v${version}`;

    execSync('git push origin HEAD', { stdio: 'inherit', env });
    execSync(`git push origin ${tag}`, { stdio: 'inherit', env });

    execSync(
        'node ./node_modules/electron-builder/cli.js --win --publish always',
        { stdio: 'inherit', env }
    );
}

publish().catch(error => {
    console.error(error);
    process.exit(1);
});
