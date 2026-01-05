# Backup and Restore Wizard

Create a comprehensive backup/restore wizard that handles Docker volumes, *Arr databases, Plex/Jellyfin metadata, and configuration files. Support local, S3-compatible, and rclone destinations with scheduled backups.

## Rationale
Currently identified as a known gap. Users need reliable backup solutions for their media stacks. Manual Docker volume backups are error-prone. This addresses the 'no guided migration path when upgrading or moving servers' pain point from competitor analysis.

## User Stories
- As a self-hoster, I want to backup my entire media stack configuration so that I can recover from disasters without losing my carefully tuned settings
- As a privacy-conscious user, I want encrypted backups to cloud storage so that my configuration secrets are protected

## Acceptance Criteria
- [ ] Users can backup all service configs and databases with one click
- [ ] Backups are compressed and optionally encrypted
- [ ] Support for local directory, S3, and rclone destinations
- [ ] Restore wizard validates backup integrity before restoring
- [ ] Scheduled automated backups with configurable retention
- [ ] Backup progress shown with estimated time remaining
