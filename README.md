# SecuredLanding

Premium land-backed lending marketplace for borrowers and investors.

## Featured first customer

The app includes Lords Farms LLC as the first current investment listing:

- Funding goal: $40,000
- Already committed: $10,000
- Lead investor: Melvin Askew
- Remaining funding: $30,000
- Investor return shown: 9%
- Max loan-to-value: 50%

## Environment variables

Add these in Vercel for the frontend and Railway for the backend.

### Vercel frontend

```text
VITE_CLERK_PUBLISHABLE_KEY=pk_test_or_live_key
VITE_RAILWAY_API_URL=https://your-railway-api.up.railway.app
```

### Railway backend

```text
CLERK_SECRET_KEY=sk_test_or_live_key
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
REPORTALL_API_KEY=your_reportall_api_key
DATABASE_URL=postgresql_database_url
```

## Integration endpoints expected on Railway

The frontend is wired to call these protected backend routes when Railway is connected:

```text
POST /api/plaid/create-link-token
POST /api/plaid/exchange-public-token
POST /api/reportall/property-report
POST /api/investments/reserve
```

Until `VITE_RAILWAY_API_URL` is added, the app runs in demo mode and shows the integration workflow without sending live API requests.
