# Database Backup & Disaster Recovery Procedures

## 1. Backup Strategy

Church member records, family connections, and Scripture collections represent vital historical data. A multi-tier backup approach is recommended:

### Tier 1: Automated MongoDB Atlas Cloud Backups
- **Continuous Backups:** Enabled via MongoDB Atlas cluster settings (7-day point-in-time restore).
- **Daily Snapshots:** Retained for 30 days.

### Tier 2: Free In-App Telegram Database Backup (`/backup`)
- The church administrator can trigger a full database backup at any time:
  1. Send `/backup` to the Telegram bot or open `📤 Export` -> `📦 Full Database Backup`.
  2. The bot serializes all collections (`members`, `churchevents`, `tasks`, `memorials`, `settings`, `greetinglogs`) into a compressed JSON (`.json.gz`) archive.
  3. The encrypted/compressed archive is delivered directly to the administrator's private Telegram chat via Telegram's high-capacity document transmission.
  4. This provides **100% free, unlimited, permanent off-site backup storage** in your Telegram saved history.

### Tier 3: Free Automated GitHub Actions Backup (`.github/workflows/backup.yml`)
- Runs automatically every Sunday at 05:30 IST (00:00 UTC) or manually via GitHub Actions workflow dispatch.
- Dumps the MongoDB database using `mongodump` and uploads an encrypted gzip archive retained for 30 days as a private repository artifact.
- Requires secret `MONGO_URI` configured in your GitHub Repository settings.

### Tier 4: Administrative CSV Database Exports
- The church administrator can trigger a roster export at any time:
  1. Open Telegram bot -> `/menu` -> `📤 Export` or Web Dashboard -> `📥 Download CSV`.
  2. Select `👥 All members` or `💍 Married couples`.
  3. The bot generates an Excel-compatible, BOM-prefixed UTF-8 spreadsheet.

---

## 2. Command-Line Backup (`mongodump`)

To perform an offline or cold backup:

```bash
# Export all collections into an archive
mongodump --uri="<MONGO_URI>" --archive=spbc_backup_$(date +%F).archive --gzip
```

---

## 3. Restoration Procedure

To restore data from an archive into a recovery or staging database:

```bash
# Restore from compressed archive
mongorestore --uri="<TARGET_MONGO_URI>" --archive=spbc_backup_YYYY-MM-DD.archive --gzip --drop
```

> [!CAUTION]
> The `--drop` flag replaces existing collections. Always verify the target connection string before executing restoration commands. Never execute restore operations against production without explicit administrative confirmation.
