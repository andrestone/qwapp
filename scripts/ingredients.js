const fs = require('fs-extra');
const path = require('path');
const yargs = require('yargs');

const root = path.dirname(require.resolve('../package.json'));

const args = yargs.argv;

if (args.name && args.template) {
  const templatePath = path.join(root, 'templates', args.template);
  const packageName = args.name;
  const packageDir = path.join(root, '/packages', `/${packageName}`);
  try {
    fs.mkdirpSync(packageDir);
    fs.copySync(templatePath, packageDir, {
      recursive: true,
    });
    // Change packages name
    changeName(packageDir, packageName);
  } catch (e) {
    throw e;
  }
  process.stdout.write(`Workspace ${packageName}: packages created at ${packageDir}\n`);
} else {
  process.stderr.write('Usage: node ingredients.js --name package-name --template template-name\n');
}

function changeName(packageDir, packageName) {
  const packageJsonPath = path.join(packageDir, `/package.json`);
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
    packageJson.name = `${packageName}`;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
}

