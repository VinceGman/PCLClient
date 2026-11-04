const { execSync } = require("child_process");

const token = process.env.GH_TOKEN;

if (!token) throw new Error("GH_TOKEN missing from .env");

const auth = Buffer.from(`x-access-token:${token}`).toString("base64");

const env = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
  GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`,
};

execSync("git push origin HEAD", { stdio: "inherit", env });
execSync('git push origin v' + require('./package.json').version, { stdio: 'inherit', env });

execSync("node ./node_modules/electron-builder/cli.js --win --publish always", {
  stdio: "inherit",
  env,
});
