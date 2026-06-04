# TMMT GHL location map

Location ID is in the URL: `https://app.gohighlevel.com/v2/location/LOCATION_ID/launchpad`

Inbound webhook URL comes from **Automation → Workflows → Inbound Webhook** (starts with `https://services.leadconnectorhq.com/hooks/...`).

| Location ID | GHL sub-account name (fill in) | `partner_app_slug` | Inbound webhook URL (fill in) |
|-------------|----------------------------------|--------------------|--------------------------------|
| `Xcd8DZt5T4GWnBtBEC5V` | TMMT Rentals *(confirmed in env)* | `tmmt_rentals` | |
| `s8QGoe5XXzyaDtHPUtBR` | | | |
| `MzniJxhyYzUndJDjMkvm` | | | |
| `IUOThggAD347OwGX6qZZ` | | | |

## Get webhook URL (2 min per location)

1. Open launchpad for that location.
2. **Automation → Workflows → Create workflow**.
3. Trigger: **Inbound Webhook**.
4. Copy the URL GHL shows (not the launchpad link).
5. Paste into the table above + into `PARTNER_APP_WEBHOOKS_JSON` below.

## Vercel env (paste after webhook URLs exist)

```bash
GHL_LOCATION_ID=Xcd8DZt5T4GWnBtBEC5V

PARTNER_APP_WEBHOOKS_JSON={"tmmt_rentals":{"url":"PASTE_HOOK_FOR_Xcd8DZt5"},"LOCATION_2_SLUG":{"url":"PASTE_HOOK_FOR_s8QGoe5"},"LOCATION_3_SLUG":{"url":"PASTE_HOOK_FOR_MzniJxhy"},"LOCATION_4_SLUG":{"url":"PASTE_HOOK_FOR_IUOThgg"}}
```

Replace `LOCATION_2_SLUG` etc. with slugs from [GHL_DISPATCH_SETUP.md](./GHL_DISPATCH_SETUP.md) (e.g. `vendor_connect`, `moving`, `fleet_manager`).

## Quick links

- [Rentals — Xcd8DZt5](https://app.gohighlevel.com/v2/location/Xcd8DZt5T4GWnBtBEC5V/launchpad)
- [Location s8QGoe5](https://app.gohighlevel.com/v2/location/s8QGoe5XXzyaDtHPUtBR/launchpad)
- [Location MzniJxhy](https://app.gohighlevel.com/v2/location/MzniJxhyYzUndJDjMkvm/launchpad)
- [Location IUOThgg](https://app.gohighlevel.com/v2/location/IUOThggAD347OwGX6qZZ/launchpad)
