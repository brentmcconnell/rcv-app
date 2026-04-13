# Ranked Choice Voting (RCV) App

A web-based polling application that lets multiple users vote on survey items using ranked choice voting with Borda count scoring. Built with vanilla HTML/CSS/JavaScript and backed by Azure Table Storage.

## Features

- **Passcode-gated access** — shared passcode controls entry to the app
- **Ranked choice voting** — voters drag/click to rank survey items in order of preference
- **Borda count scoring** — 1st place gets N points, 2nd gets N-1, etc.
- **Duplicate voter detection** — fuzzy name matching via Levenshtein distance
- **Admin panel** — add/remove survey items with a separate admin code
- **Live results** — bar chart visualization of scores and voter list

## Pages

| Page | Purpose |
|------|---------|
| `index.html` | Passcode entry gate |
| `vote.html` | Name entry → rank items → submit vote |
| `results.html` | Borda count results with bar chart and voter list |
| `admin.html` | Add/remove survey items (requires admin code) |

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) (>= 1.0)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`)
- An Azure subscription

## Deploy to Azure

1. **Authenticate with Azure:**

   ```bash
   az login
   az account set --subscription <SUBSCRIPTION_ID>
   ```

2. **Initialize Terraform:**

   ```bash
   cd terraform
   terraform init
   ```

3. **Create a `terraform.tfvars` file** in the `terraform/` directory:

   ```hcl
   storage_account_name = "rcvapp2025"   # Must be globally unique, 3-24 lowercase alphanumeric
   app_passcode         = "your-passcode"
   admin_code           = "your-admin-code"

   # Optional (defaults shown):
   # resource_group_name = "rg-rcv-app"
   # location            = "eastus"
   # sas_start           = "2025-01-01T00:00:00Z"
   # sas_expiry          = "2027-12-31T23:59:59Z"
   ```

   > **Do not commit `terraform.tfvars` to version control** — it contains sensitive values.

4. **Deploy:**

   ```bash
   terraform plan    # Preview what will be created
   terraform apply   # Deploy resources
   ```

   Terraform will:
   - Create a resource group and storage account
   - Create `survey` and `votes` tables
   - Generate a SAS token
   - Configure CORS on the table service
   - Write credentials into `frontend/js/config.js`
   - Upload the frontend to the `$web` static website container

5. **Get the app URL:**

   ```bash
   terraform output website_url
   ```

## Run Locally (for development)

You still need an Azure Storage account for the backend. After deploying with Terraform (or manually creating the storage account and tables), edit `frontend/js/config.js` with your credentials:

```javascript
const CONFIG = {
  storageAccount: "yourstorageaccount",
  sasToken: "your-sas-token",
  passcode: "your-passcode",
  adminCode: "your-admin-code"
};
```

Then serve the frontend with any static file server:

```bash
cd frontend
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

## Teardown

```bash
cd terraform
terraform destroy
```

## Architecture

```
Browser ──(REST + SAS token)──▶ Azure Table Storage
                                  ├── survey table (config/items)
                                  └── votes table (voter rankings)

Azure Storage Account
  ├── $web container (static website hosting)
  └── Table service (survey + votes)
```

All application logic runs client-side. The frontend calls Azure Table Storage directly using a SAS token — there is no backend server.
