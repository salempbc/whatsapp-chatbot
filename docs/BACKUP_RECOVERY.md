# Database Backup & Disaster Recovery Procedures

## 1. Backup Strategy

Church member records, family connections, and Scripture collections represent vital historical data. A multi-tier backup approach is recommended:

### Tier 1: Automated MongoDB Atlas Cloud Backups
- **Continuous Backups:** Enabled via MongoDB Atlas cluster settings (7-day point-in-time restore).
- **Daily Snapshots:** Retained for 30 days.

### Tier 2: Administrative CSV Database Exports
- The church administrator can trigger a full snapshot at any time:
  1. Open Telegram bot -> `/menu` -> `📤 Export` or Web Dashboard -> `📥 Download CSV`.
  2. Select `👥 All members`.
  3. The bot generates an Excel-compatible, BOM-prefixed UTF-8 spreadsheet containing all member records, dates, family names, and spouse links.

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
