const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.GH_TOKEN;
const owner = 'VinceGman';
const repo = 'PCLClient';

if (!token) throw new Error('GH_TOKEN missing from .env');

const version = require('../../package.json').version;
const tag = `v${version}`;

const auth = Buffer.from(`x-access-token:${token}`).toString('base64');

const env = {
    ...process.env,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`
};

function request(hostname, apiPath, method = 'GET', body = null, contentType = 'application/json') {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            path: apiPath,
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': 'PCLClient',
                Accept: 'application/vnd.github+json',
                ...(body ? {
                    'Content-Type': contentType,
                    'Content-Length': body.length
                } : {})
            }
        }, res => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('end', () => {
                let result = {};

                try {
                    result = data ? JSON.parse(data) : {};
                } catch {}

                resolve({ status: res.statusCode, data: result });
            });
        });

        req.on('error', reject);

        if (body) req.write(body);

        req.end();
    });
}

async function publish() {
    const dist = path.join(__dirname, '../../dist');

    // Clean previous builds.
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(dist, { recursive: true });

    console.log('Cleaned dist directory.');

    // Push commit and version tag.
    execSync('git push origin HEAD', {
        stdio: 'inherit',
        env
    });

    execSync(`git push origin ${tag}`, {
        stdio: 'inherit',
        env
    });

    // Build without Electron Builder publishing.
    execSync(
        'node ./node_modules/electron-builder/cli.js --win --publish never',
        {
            stdio: 'inherit',
            env
        }
    );

    // Find existing release.
    const releasePath = `/repos/${owner}/${repo}/releases/tags/${tag}`;

    let result = await request('api.github.com', releasePath);

    let release;

    if (result.status === 200) {
        release = result.data;
        console.log(`Reusing existing release: ${tag}`);
    } else if (result.status === 404) {
        console.log(`Creating release: ${tag}`);

        result = await request(
            'api.github.com',
            `/repos/${owner}/${repo}/releases`,
            'POST',
            Buffer.from(JSON.stringify({
                tag_name: tag,
                name: version,
                draft: false,
                prerelease: false
            }))
        );

        if (result.status !== 201) {
            throw new Error(`Release creation failed: ${JSON.stringify(result.data)}`);
        }

        release = result.data;
    } else {
        throw new Error(`GitHub API error: ${JSON.stringify(result.data)}`);
    }

    // Identify only the files needed for installation and updates.
    const installer = `PCL.exe`;

    const assets = fs.readdirSync(dist).filter(file =>
        file === installer ||
        file === `${installer}.blockmap` ||
        file === 'latest.yml'
    );

    if (!assets.includes(installer)) {
        throw new Error('Installer EXE was not generated.');
    }

    if (!assets.includes('latest.yml')) {
        throw new Error('latest.yml was not generated.');
    }

    // Upload only the current installer and updater files.
    for (const file of assets) {
        const buffer = fs.readFileSync(path.join(dist, file));

        const uploadPath =
            `/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(file)}`;

        const uploaded = await request(
            'uploads.github.com',
            uploadPath,
            'POST',
            buffer,
            'application/octet-stream'
        );

        if (uploaded.status !== 201) {
            throw new Error(`Upload failed for ${file}: ${JSON.stringify(uploaded.data)}`);
        }

        console.log(`Uploaded: ${file}`);
    }

    console.log(`Publishing complete: ${tag}`);
}

publish().catch(error => {
    console.error(error);
    process.exit(1);
});