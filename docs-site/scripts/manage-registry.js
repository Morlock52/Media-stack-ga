
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_PATH = path.join(__dirname, '../src/data/apps-registry.json');
const BACKUP_DIR = path.join(__dirname, '../src/data/backups');
const DOCS_DIR = path.join(__dirname, '../src/components/docs');

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// --- Actions ---

const loadRegistry = () => {
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    } catch (e) {
        console.error('Failed to load registry:', e.message);
        process.exit(1);
    }
};

const saveRegistry = (data) => {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 4));
    console.log('Registry saved.');
};

const sync = () => {
    try {
        console.log('Syncing generated files...');
        // We are in docs-site/scripts, so just run the sibling file
        execSync('node sync-apps.js', { stdio: 'inherit', cwd: __dirname });
    } catch (e) {
        console.error('Failed to sync apps:', e.message);
    }
};

const backup = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `registry-${timestamp}.json`);
    fs.copyFileSync(REGISTRY_PATH, backupPath);
    console.log(`Backup created at: ${backupPath}`);
    return backupPath;
};

const verify = () => {
    const registry = loadRegistry();
    console.log(`Verifying ${registry.length} apps...`);

    const errors = [];
    const ids = new Set();

    registry.forEach((app, index) => {
        // ID Uniqueness
        if (ids.has(app.id)) {
            errors.push(`Duplicate ID found: ${app.id}`);
        }
        ids.add(app.id);

        // Required Fields
        if (!app.name) errors.push(`App at index ${index} missing 'name'`);
        if (!app.description) errors.push(`App ${app.id || index} missing 'description'`);
        if (!app.category) errors.push(`App ${app.id || index} missing 'category'`);
        if (!app.icon) errors.push(`App ${app.id || index} missing 'icon'`);

        // Profiles (Warn only)
        if (!app.profile) console.warn(`Warning: App ${app.id} has no 'profile' (won't appear in wizard)`);

        // Check Docs Stub/Guide
        let guideComponent = app.guideComponent;
        if (!guideComponent) {
            guideComponent = app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
        }
        const guidePath = path.join(DOCS_DIR, `${guideComponent}.tsx`);
        if (!fs.existsSync(guidePath)) {
            // This is technically auto-fixed by the build script, but good to know
            console.warn(`Notice: Doc file for ${app.id} does not exist yet (will be auto-generated on build): ${guideComponent}.tsx`);
        }
    });

    if (errors.length > 0) {
        console.error('\nVerification FAILED with errors:');
        errors.forEach(e => console.error(`- ${e}`));
        return false;
    } else {
        console.log('Verification PASSED.');
        return true;
    }
};

const list = () => {
    const registry = loadRegistry();
    console.log('\nCurrent Apps Registry:');
    console.log('----------------------------------------------------------------');
    console.log('| ID                | Name                | Category       |');
    console.log('----------------------------------------------------------------');
    registry.forEach(app => {
        console.log(`| ${app.id.padEnd(17)} | ${app.name.padEnd(19)} | ${app.category.padEnd(14)} |`);
    });
    console.log('----------------------------------------------------------------');
};

const fetchIconFromGithub = async (githubUrl, appId) => {
    try {
        // Extract owner/repo
        const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) return null;

        const [_, owner, repo] = match;
        const iconDir = path.join(__dirname, '../public/icons');
        if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

        // Try locations in order of likelihood
        const attempts = [
            `https://raw.githubusercontent.com/${owner}/${repo}/main/public/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/master/public/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/master/assets/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/main/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/master/logo.png`,
            `https://raw.githubusercontent.com/${owner}/${repo}/main/icon.png`,
            `https://github.com/${owner}.png` // Fallback to user/org avatar
        ];

        for (const url of attempts) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const contentType = res.headers.get('content-type');
                    let ext = '.png';
                    if (contentType.includes('svg')) ext = '.svg';
                    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';

                    const filename = `${appId}${ext}`;
                    const filepath = path.join(iconDir, filename);

                    const buffer = Buffer.from(await res.arrayBuffer());
                    fs.writeFileSync(filepath, buffer);
                    console.log(`Downloaded icon from ${url}`);
                    return `/icons/${filename}`;
                }
            } catch (e) {
                // Continue to next attempt
            }
        }
    } catch (e) {
        console.error('Failed to fetch icon:', e.message);
    }
    return null;
};

const add = async () => {
    // Basic argument parsing for non-interactive usage
    const args = process.argv.slice(3).reduce((acc, arg) => {
        const [key, value] = arg.split('=');
        if (key && value) acc[key.replace(/^--/, '')] = value;
        return acc;
    }, {});

    console.log('\nAdd New App Wizard');

    let id = args.id;
    if (!id) id = await question('ID (kebab-case): ');
    if (!id) return;

    const registry = loadRegistry();
    if (registry.find(a => a.id === id)) {
        console.error('Error: ID already exists.');
        return;
    }

    let name = args.name;
    if (!name) name = await question('Name: ');

    let description = args.description;
    if (!description) description = await question('Description: ');

    let category = args.category;
    if (!category) category = await question('Category (Media Server, Automation, etc): ');

    // Optional GitHub URL for icon fetching
    let githubUrl = args.github;
    if (!githubUrl && !args.id) { // Only ask interactively
        const input = await question('GitHub URL (optional, for auto-icon): ');
        if (input.trim()) githubUrl = input.trim();
    }

    let logoPath = '';
    if (githubUrl) {
        console.log('Attempting to fetch icon from GitHub...');
        const fetchedLogo = await fetchIconFromGithub(githubUrl, id);
        if (fetchedLogo) {
            logoPath = fetchedLogo;
            console.log(`Icon set to: ${logoPath}`);
        } else {
            console.log('Could not automatically find an icon.');
        }
    }

    let icon = args.icon;
    if (!icon) icon = await question('Lucide Icon Name (fallback e.g. Box): ');

    let profile = args.profile;
    if (!profile && !args.noProfile) profile = await question('Docker Profile (optional): ');

    const newApp = {
        id,
        name,
        description,
        category,
        icon,
        ...(logoPath && { logo: logoPath }),
        ...(profile && { profile }),
        difficulty: 'Medium',
        setupTime: '15-30 min'
    };

    backup();
    registry.push(newApp);

    saveRegistry(registry);
    console.log(`App ${name} added.`);
    sync();
};

const remove = async () => {
    const id = process.argv[3];
    const force = process.argv.includes('--force');

    if (!id || id.startsWith('--')) {
        console.error('Usage: node manage-registry.js remove <id> [--force]');
        return;
    }

    const registry = loadRegistry();
    const index = registry.findIndex(a => a.id === id);
    if (index === -1) {
        console.error('App not found.');
        return;
    }

    const app = registry[index];

    if (!force) {
        const confirm = await question(`Are you sure you want to delete ${app.name} (${id})? [y/N] `);
        if (confirm.toLowerCase() !== 'y') return;
    }

    backup();
    registry.splice(index, 1);
    saveRegistry(registry);

    // Ask to delete docs
    let guideComponent = app.guideComponent;
    if (!guideComponent) {
        guideComponent = app.name.replace(/[^a-zA-Z0-9]/g, '') + 'Guide';
    }
    const guidePath = path.join(DOCS_DIR, `${guideComponent}.tsx`);
    if (fs.existsSync(guidePath)) {
        if (force) {
            fs.unlinkSync(guidePath);
            console.log('Docs deleted.');
        } else {
            const delDocs = await question(`Delete documentation file (${guideComponent}.tsx)? [y/N] `);
            if (delDocs.toLowerCase() === 'y') {
                fs.unlinkSync(guidePath);
                console.log('Docs deleted.');
            }
        }
    }

    console.log('App removed.');
    sync();
};

const share = async () => {
    const id = process.argv[3];
    if (!id) {
        console.error('Usage: node manage-registry.js share <id>');
        return;
    }
    const registry = loadRegistry();
    const app = registry.find(a => a.id === id);
    if (!app) {
        console.error('App not found.');
        return;
    }

    const shareFile = path.join(process.cwd(), `${id}-share.json`);
    fs.writeFileSync(shareFile, JSON.stringify(app, null, 2));
    console.log(`App definition exported to ${shareFile}`);
    console.log('Content:');
    console.log(JSON.stringify(app, null, 2));
};

const edit = async () => {
    const id = process.argv[3];
    const registry = loadRegistry();

    let targetId = id;
    if (!targetId) {
        // Interactive selection if no ID provided
        console.log('Available Apps:');
        registry.forEach(app => console.log(`- ${app.id} (${app.name})`));
        targetId = await question('Enter ID of app to edit: ');
    }

    const index = registry.findIndex(a => a.id === targetId);
    if (index === -1) {
        console.error('App not found.');
        return;
    }

    const app = { ...registry[index] };
    console.log(`\nEditing ${app.name} (${app.id})`);
    console.log('Press Enter to keep current value.\n');

    const name = await question(`Name [${app.name}]: `);
    if (name) app.name = name;

    const description = await question(`Description [${app.description}]: `);
    if (description) app.description = description;

    const category = await question(`Category [${app.category}]: `);
    if (category) app.category = category;

    // Icon handling
    const currentIcon = app.logo ? 'Custom (Logo)' : app.icon;
    console.log(`Current Icon: ${currentIcon}`);

    const updateIcon = await question('Update Icon? (y/n/github) [n]: ');
    if (updateIcon.toLowerCase() === 'y') {
        const newIcon = await question(`Lucide Icon Name [${app.icon}]: `);
        if (newIcon) app.icon = newIcon;
    } else if (updateIcon.toLowerCase() === 'github') {
        const githubUrl = await question('GitHub URL: ');
        if (githubUrl) {
            console.log('Fetching icon...');
            const logoPath = await fetchIconFromGithub(githubUrl, app.id);
            if (logoPath) {
                app.logo = logoPath;
                console.log(`Logo updated to ${logoPath}`);
            } else {
                console.log('Failed to fetch logo from GitHub.');
            }
        }
    }

    // Profile handling - CRITICAL for Stack Selection
    const profile = await question(`Docker Profile (Required for Stack Selection) [${app.profile || ''}]: `);
    if (profile) app.profile = profile;
    else if (!app.profile && profile === '') {
        // If they explicitly cleared it or left it empty when it was already empty
        // Warn them
        console.warn('WARNING: Without a profile, this app will NOT appear in the Setup Wizard Stack Selection.');
    }

    const difficulty = await question(`Difficulty [${app.difficulty || 'Medium'}]: `);
    if (difficulty) app.difficulty = difficulty;

    const setupTime = await question(`Setup Time [${app.setupTime || '15-30 min'}]: `);
    if (setupTime) app.setupTime = setupTime;

    // Save
    registry[index] = app;
    backup();
    saveRegistry(registry);
    console.log('App updated successfully.');
    sync();
};

const help = () => {
    console.log(`
Media Stack App Lifecycle Manager
=================================
Usage: node manage-registry.js [command]

Commands:
  list              List all apps in registry
  add               Interactive wizard to add new app
  edit [id]         Edit an existing app (Metadata, Icon, Profile)
  remove <id>       Remove an app and optionally its docs
  verify            Verify registry integrity
  backup            Create a backup of the registry
  share <id>        Export an app definition to JSON
    `);
};

// --- Main ---

const command = process.argv[2];

(async () => {
    switch (command) {
        case 'list': list(); break;
        case 'add': await add(); break;
        case 'edit': await edit(); break;
        case 'remove': await remove(); break;
        case 'verify': verify(); break;
        case 'backup': backup(); break;
        case 'share': await share(); break;
        default: help(); break;
    }
    rl.close();
})();
