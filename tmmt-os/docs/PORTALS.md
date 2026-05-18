# Three-portal architecture

One platform (TMMT OS), three interfaces, shared Supabase login.

## Portals

| Portal | Path | Who |
|--------|------|-----|
| **Client** | `/client/*` | Paying customers — content gated by **package** |
| **Team** | `/team/*` | Internal team, contractors, sales, support, trainers |
| **Admin** | `/admin/*` | Owners and leadership — scoped by **admin_scope** |
| **Ops** (legacy) | `/internal/*`, `/vendor/*` | Case workflow engine (unchanged) |

Users with multiple roles use **Portal Switcher** in the header or visit `/portals`.

## Two layers of access

### 1. Roles (`profiles.portal_role`)

- `client` — Client Portal only
- `team_member` — Team Portal
- `manager` — Team + Client
- `admin` — Admin + Team + Client (limited by `admin_scope`)
- `super_admin` — All portals + all admin sections

Legacy `profiles.role` (`internal_team`, `vendor`, etc.) still gates Ops portals.

### 2. Entitlements (packages + grants)

- **Packages:** `starter`, `growth`, `elite`, `custom`
- **Package entitlements:** `package_entitlements` table
- **Manual grants:** `profile_entitlement_grants` for custom clients

Assign a package:

```sql
update public.profiles
set package_id = (select id from public.packages where slug = 'growth')
where email = 'client@example.com';
```

Grant a single module:

```sql
insert into public.profile_entitlement_grants (profile_id, entitlement_slug, note)
values (
  '<profile-uuid>',
  'analytics_dashboard',
  'Promo access'
);
```

## Admin scopes

| Scope | Can manage |
|-------|------------|
| `super` | Everything |
| `manager` | Users, activity, support, training |
| `finance` | Revenue, packages, client billing views |
| `content` | Documents, training, entitlements |

```sql
update public.profiles
set portal_role = 'admin', admin_scope = 'finance'
where email = 'cfo@example.com';
```

## Team departments

Sets default Team Portal sections: `sales`, `support`, `training`, `ops`, `general`.

```sql
update public.profiles
set portal_role = 'team_member', team_department = 'sales'
where email = 'rep@example.com';
```

## Migration

Apply `supabase/migrations/0005_portals_entitlements.sql` after `0001` (and `0004` if used).
