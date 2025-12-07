---
description: Full lifecycle management of the App Registry (Add, Edit, Remove, Backup, Verify)
---

# App Registry Lifecycle Management

We use a CLI tool to manage `docs-site/src/data/apps-registry.json` and ensure consistency across the stack.

## Commands

Run these commands from the `docs-site` directory:

### 1. List Apps
View all registered apps and their status.
```bash
npm run apps:manage -- list
```

### 2. Add New App
Launches an interactive wizard to add a new app. Automatically creates backups before saving.
```bash
npm run apps:manage -- add
```

### 3. Remove App
Safely removes an app from the registry and optionally deletes its documentation file.
```bash
npm run apps:manage -- remove [app-id]
```

### 4. Verify Integrity
Checks for:
-   Broken icons
-   Missing documentation files
-   Duplicate IDs
-   Missing required fields
```bash
npm run apps:verify
```

### 5. Backup Registry
Creates a timestamped backup in `docs-site/src/data/backups/`.
```bash
npm run apps:backup
```

### 6. Share App Definition
Exports a single app's JSON definition to a file for sharing.
```bash
npm run apps:manage -- share [app-id]
```

## Best Practices
-   Always run **Verify** before committing changes.
-   Use **Add** wizard to ensure you don't miss required fields.
-   Backups are automatic on write operations, but you can run them manually before big changes.
