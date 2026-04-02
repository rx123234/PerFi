ALTER TABLE transactions ADD COLUMN exclude_from_planning INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN exclude_from_planning INTEGER NOT NULL DEFAULT 0;
