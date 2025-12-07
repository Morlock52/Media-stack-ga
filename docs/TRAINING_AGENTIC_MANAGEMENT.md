
# 🎓 Training: Agentic App Management

> **Objective**: Learn how to manage your Media Stack components (Apps & Docs) using the AI Assistant's new agentic capabilities.

## 1. Overview
The Media Stack now includes an **Agentic Registry Manager**. This means you don't need to manually edit JSON files to add or remove applications anymore. You can simply ask the AI.

**Supported Actions:**
- **Add App**: Register a new application tile.
- **Update App**: Modify details like description or repo URL.
- **Remove App**: Delete an application from the registry.
- **Manage Docs**: Create or update documentation guides.

---

## 2. Adding an App ("Add Tile")

**Scenario**: You want to add "Uptime Kuma" to your dashboard.

**Steps:**
1.  Open the **AI Assistant** (bottom right corner).
2.  Type: `Add Uptime Kuma to my stack`.
3.  **Optional**: You can provide details: `Add Uptime Kuma with repo https://github.com/louislam/uptime-kuma`.

**What Happens:**
- The AI detects the intent `manage_app`.
- It executes the `add` action against the registry.
- It responds with a confirmation.

**Example Chat:**
> **You**: Add Uptime Kuma to my stack.
> **AI**: ✅ Added app: Uptime Kuma (ID: uptime-kuma).

---

## 3. Editing an App

**Scenario**: You want to update the description of an app.

**Steps:**
1.  Open the **AI Assistant**.
2.  Type: `Update Uptime Kuma description to "The best monitoring tool"`.

**Example Chat:**
> **You**: Update Uptime Kuma description to "The best monitoring tool".
> **AI**: ✅ Updated app: Uptime Kuma (ID: uptime-kuma).

---

## 4. Removing an App

**Scenario**: You no longer need an app.

**Steps:**
1.  Open the **AI Assistant**.
2.  Type: `Remove Uptime Kuma`.

**Example Chat:**
> **You**: Remove Uptime Kuma.
> **AI**: 🗑️ Removed app: uptime-kuma.

---

## 5. Managing Documentation

**Scenario**: You want to create a new guide for a specific tool.

**Steps:**
1.  Open the **AI Assistant**.
2.  Type: `Create a quick start guide for Uptime Kuma`.

**What Happens:**
- The AI calls `manage_doc` with `action: write`.
- It creates a file (e.g., `docs-site/docs/uptime-kuma-guide.md`).
- It populates it with relevant content.

---

## 🎥 Visual Demonstration
*A recording of these actions is available in the artifacts: `training_agentic_app_management`*
