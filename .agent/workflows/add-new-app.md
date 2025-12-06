---
description: How to add a new application to the Media Stack Docs & Wizard
---

# Adding a New App

This project uses a centralized registry to manage application metadata, wizard integration, and documentation links.

## Steps

1.  **Open the Registry**
    Open `docs-site/src/data/apps-registry.json`.

2.  **Add App Entry**
    Add a new object to the array following this schema:
    ```json
    {
      "id": "app-id",
      "name": "App Name",
      "description": "Short description for cards",
      "category": "category-name",
      "icon": "LucideIconName",
      "logo": "/icons/app-logo.svg", // Optional
      "profile": "docker-compose-profile-name", // Required if it should appear in Wizard
      "difficulty": "Easy", // Easy, Medium, Advanced
      "setupTime": "15-30 min",
      "guideComponent": "AppGuide" // Optional, defaults to [Name]Guide
    }
    ```

3.  **Run Dev or Build**
    Start the dev server:
    ```bash
    npm run dev
    ```
    This will automatically:
    - Generate `docs-site/src/data/services.ts` (for Setup Wizard)
    - Generate `docs-site/src/components/docs/appData.ts` (for Apps Overview)
    - Generate `docs-site/src/components/docs/index.ts` (Routing)
    - Create a stub Guide file (e.g., `src/components/docs/AppGuide.tsx`) if it doesn't exist.

4.  **Edit Documentation**
    Open the generated guide file (e.g., `src/components/docs/AppGuide.tsx`) and add your specific setup instructions.

## Best Practices

-   **Icons**: Use standard [Lucide React](https://lucide.dev/icons/) icon names. The build script automatically imports them.
-   **Profiles**: Ensure the `profile` matches the Docker Compose profile used in your backend logic.
-   **Categories**: Try to reuse existing categories (Media Server, Automation, Downloads, etc.) for consistency.
