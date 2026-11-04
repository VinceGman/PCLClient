
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.GH_TOKEN;
const owner = 'VinceGman';
const repo = 'PCLClient';

if (!token) throw new Error('GH_TOKEN missing from .env');

const version = require('./package.json').version;
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
    // Push commit and version tag.
    execSync('git push origin HEAD', { stdio: 'inherit', env });
    execSync(`git push origin ${tag}`, { stdio: 'inherit', env });

    // Build without Electron Builder publishing.
    execSync(
        'node ./node_modules/electron-builder/cli.js --win --publish never',
        { stdio: 'inherit', env }
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

    // Upload missing build assets.
    const dist = path.join(__dirname, 'dist');

    if (fs.existsSync(dist)) {
        for (const file of fs.readdirSync(dist)) {
            if (/^PCL-Client-Setup-.*\.(exe|blockmap)$/i.test(file)) {
                fs.unlinkSync(path.join(dist, file));
                console.log(`Deleted old build: ${file}`);
            }
        }
    }

    const assets = fs.readdirSync(dist)
        .filter(file =>
            file === `PCL-Client-Setup-${version}.exe` ||
            file === `PCL-Client-Setup-${version}.exe.blockmap` ||
            file === 'latest.yml'
        );

    for (const file of assets) {
        const existing = release.assets.some(asset => asset.name === file);

        if (existing) {
            console.log(`Already uploaded: ${file}`);
            continue;
        }

        const filePath = path.join(dist, file);
        const buffer = fs.readFileSync(filePath);

        const uploadPath =
            `/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(file)}`;

        const contentType = file.endsWith('.exe')
            ? 'application/octet-stream'
            : 'application/octet-stream';

        const uploaded = await request(
            'uploads.github.com',
            uploadPath,
            'POST',
            buffer,
            contentType
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
