# Built-in Accounts

Default accounts are created automatically on first run when their configured credentials are present. Do not commit actual passwords to version control.

## Setup

Set these environment variables before deployment to define built-in account credentials:

- `ADMIN_EMAIL` - Admin account email (default: admin@renttrack.com)
- `ADMIN_PASSWORD` - Adminrentrack
- `OWNER_EMAIL` - Owner account email (default: renttrackowner@gmail.com)
- `OWNER_PASSWORD` - RentrackOwner

## Roles

- **Admin** - Full system access
- **Owner** - Property management access
- **Agent** - Tenant and property management
- **Tenant** - Rent payment and profile management

## Security Notes

- Change default credentials immediately after first login
- Use strong, unique passwords for each account
- Enable 2FA where available
- Rotate credentials regularly
- Never expose credentials in client-side code or public repositories
- To reset existing built-in account passwords once, set `FORCE_BUILTIN_PASSWORD_RESET=true`, restart the app, then remove it after a successful sign-in.
