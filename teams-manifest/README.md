# OTH Teams App Manifest

## Before packaging

### 1. Fill in manifest.json placeholders
Replace these literals in `manifest.json`:
| Placeholder | Value |
|---|---|
| `${TEAMS_BOT_APP_ID}` | Application (client) ID of your backend app registration (Step 2) |
| `${FRONTEND_DOMAIN}` | Your production frontend domain e.g. `app.olympus-eqc.com` |

### 2. Add icon files
Teams requires two PNG icons placed in this folder:

| File | Size | Notes |
|---|---|---|
| `color.png` | 192×192 px | Full-colour app icon (used in app store, tabs) |
| `outline.png` | 32×32 px | White/transparent outline icon (used in sidebar) |

Use the Olympus logo or a custom OTH icon. Both must be square PNGs.

### 3. Required Graph API permissions (Application, admin-consented)
Add these in the Azure portal under **App registrations → your backend app → API permissions**:

| Permission | Type | Purpose |
|---|---|---|
| `User.Read.All` | Application | Read user profiles + manager relationships |
| `TeamsAppInstallation.ReadWriteForUser.All` | Application | Install the Teams bot for users proactively |
| `Chat.ReadBasic.All` | Application | Retrieve the bot–user chat ID |
| `ChatMessage.Send` | Application | Send Adaptive Card messages into chats |

### 4. Register a Bot Channel on your Azure app
In the Azure portal:
1. Go to **App registrations → your backend app**
2. Open **Expose an API** and set the Application ID URI
3. Go to **Azure Bot** (or Bot Channels Registration) and create a new bot:
   - **Microsoft App ID** = your backend `GRAPH_CLIENT_ID`
   - **Messaging endpoint** = `https://<your-backend-domain>/api/webhooks/teams`
4. Enable the **Microsoft Teams** channel on the bot

### 5. Package and upload to Teams
```bash
# From this directory, zip the three files:
Compress-Archive -Path manifest.json, color.png, outline.png -DestinationPath oth-teams-app.zip

# In Teams admin center → Manage apps → Upload an app → Upload for my org
# OR in Teams → Apps → Manage your apps → Upload a custom app (dev tenants only)
```

### 6. Update .env
```env
GRAPH_TENANT_ID=<your-tenant-id>
GRAPH_CLIENT_ID=<backend-app-client-id>
GRAPH_CLIENT_SECRET=<backend-app-client-secret>
TEAMS_BOT_APP_ID=<same-as-GRAPH_CLIENT_ID>
TEAMS_APP_EXTERNAL_ID=com.olympus.eqc.oth
FRONTEND_URL=http://localhost:3000
```
