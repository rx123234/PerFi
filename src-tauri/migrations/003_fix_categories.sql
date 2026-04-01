-- Migration 003: Fix category rules and miscategorized transactions
BEGIN;

-- ── 1. Add new "Childcare" category ─────────────────────────────────────────
INSERT OR IGNORE INTO categories (id, name, color, icon)
    VALUES ('cat-childcare', 'Childcare', '#FF7043', NULL);

-- ── 2. Add missing category rules ───────────────────────────────────────────

-- Income rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-050', 'PAYROLL', 'cat-income', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-051', 'Interest Paid', 'cat-income', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-052', 'Interest paid', 'cat-income', 10);

-- Transfer rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-053', '529 ACH CONTRIB', 'cat-transfer', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-054', 'CHASE CREDIT CRD', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-055', 'AUTOMATIC PAYMENT - THANK', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-056', 'JPMorgan Chase Ext Trnsfr', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-057', 'VENMO CASHOUT', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-058', 'Requested transfer', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-059', 'Online Transfer', 'cat-transfer', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-060', 'Incoming Wire', 'cat-transfer', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-061', 'JPMORGAN CHASE', 'cat-transfer', 10);

-- Health rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-062', 'NAVIA BENEFIT', 'cat-health', 10);

-- Utilities rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-063', 'NAVIGATE COMMUNI', 'cat-utilities', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-064', 'SNOHOMISH COUNTY PUD', 'cat-utilities', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-065', 'PUGET SOUND ENER', 'cat-utilities', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-066', 'ZIPLY FIBER', 'cat-utilities', 10);

-- Housing rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-067', 'APPFOLIO', 'cat-housing', 10);

-- Childcare rules
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-068', 'LINELEADER', 'cat-childcare', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-069', 'MARTHA LAKE ELEMENTARY', 'cat-childcare', 10);

-- Shopping rules (fix GolfWRX)
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-070', 'GOLFWRX', 'cat-shopping', 10);

-- ── 3. Fix existing Venmo rule: Transfer not just priority 5 ────────────────
UPDATE category_rules SET category_id = 'cat-transfer', priority = 10
    WHERE id = 'rule-046';

-- ── 4. Fix all miscategorized existing transactions ─────────────────────────

-- 4a. Chase credit card autopay/transfers mislabeled as Subscriptions → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id = 'cat-subscriptions'
      AND (description LIKE '%CHASE CREDIT CRD%'
           OR description LIKE '%JPMorgan Chase Ext Trnsfr%'
           OR description LIKE '%JPMORGAN CHASE%');

-- 4b. Ally Bank transfers mislabeled as Subscriptions → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id = 'cat-subscriptions'
      AND description LIKE '%Requested transfer%';

-- 4c. Venmo mislabeled as Subscriptions → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id = 'cat-subscriptions'
      AND (description LIKE '%VENMO%');

-- 4d. Verizon bill pay debits mislabeled as Subscriptions → Utilities
UPDATE transactions SET category_id = 'cat-utilities'
    WHERE category_id = 'cat-subscriptions'
      AND description LIKE '%VERIZON WIRELESS PAYMENTS%';

-- 4e. Snohomish County PUD mislabeled as Housing → Utilities
UPDATE transactions SET category_id = 'cat-utilities'
    WHERE category_id = 'cat-housing'
      AND description LIKE '%SNOHOMISH COUNTY PUD%';

-- 4f. GolfWRX mislabeled as Health → Shopping
UPDATE transactions SET category_id = 'cat-shopping'
    WHERE category_id = 'cat-health'
      AND description LIKE '%GOLFWRX%';

-- 4g. Zelle incoming payments mislabeled as Income → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id = 'cat-income'
      AND description LIKE '%Zelle payment from%';

-- 4h. Fix uncategorized payroll → Income
UPDATE transactions SET category_id = 'cat-income'
    WHERE category_id IS NULL
      AND description LIKE '%PAYROLL%';

-- 4i. Fix uncategorized Interest Paid → Income
UPDATE transactions SET category_id = 'cat-income'
    WHERE category_id IS NULL
      AND description LIKE '%Interest Paid%';

-- 4j. Fix uncategorized 529 contributions → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%529 ACH CONTRIB%';

-- 4k. Fix uncategorized Navigate Communications → Utilities
UPDATE transactions SET category_id = 'cat-utilities'
    WHERE category_id IS NULL
      AND description LIKE '%Navigate Communi%';

-- 4l. Fix uncategorized AppFolio → Housing
UPDATE transactions SET category_id = 'cat-housing'
    WHERE category_id IS NULL
      AND description LIKE '%AppFolio%';

-- 4m. Fix uncategorized Navia Benefit → Health
UPDATE transactions SET category_id = 'cat-health'
    WHERE category_id IS NULL
      AND description LIKE '%NAVIA BENEFIT%';

-- 4n. Fix uncategorized Lineleader → Childcare
UPDATE transactions SET category_id = 'cat-childcare'
    WHERE category_id IS NULL
      AND description LIKE '%LINELEADER%';

-- 4o. Fix uncategorized Chase autopay → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND (description LIKE '%CHASE CREDIT CRD%'
           OR description LIKE '%AUTOMATIC PAYMENT - THANK%');

-- 4p. Fix uncategorized JPMorgan transfers → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%JPMorgan Chase%';

-- 4q. Fix uncategorized Venmo cashout → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%VENMO%';

-- 4r. Fix uncategorized Incoming Wire → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%Incoming Wire%';

-- 4s. Fix uncategorized Requested transfer → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%Requested transfer%';

-- 4t. Fix uncategorized Puget Sound Energy → Utilities
UPDATE transactions SET category_id = 'cat-utilities'
    WHERE category_id IS NULL
      AND description LIKE '%PUGET SOUND ENER%';

-- 4u. Fix uncategorized Apple Card payments → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%APPLECARD GSBANK%';

-- 4v. Fix uncategorized Citi autopay → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%CITI AUTOPAY%';

-- 4w. Fix uncategorized BECU transfers → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%BECU%TRANSFER%';

-- 4x. Fix uncategorized BofA Visa payments → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%BK OF AMER VISA%';

-- 4y. Fix uncategorized internet transfers → Transfer
UPDATE transactions SET category_id = 'cat-transfer'
    WHERE category_id IS NULL
      AND description LIKE '%Internet transfer%';

-- 4z. Fix uncategorized Mill Creek Kids → Childcare
UPDATE transactions SET category_id = 'cat-childcare'
    WHERE category_id IS NULL
      AND description LIKE '%MILL CREEK KIDS%';

-- 4aa. Fix uncategorized YMCA → Health
UPDATE transactions SET category_id = 'cat-health'
    WHERE category_id IS NULL
      AND description LIKE '%YMCA%';

-- 4ab. Fix uncategorized Verizon → Utilities
UPDATE transactions SET category_id = 'cat-utilities'
    WHERE category_id IS NULL
      AND description LIKE '%VERIZON WIRELESS%';

-- 4ac. Fix uncategorized WA DOL → Transportation
UPDATE transactions SET category_id = 'cat-transportation'
    WHERE category_id IS NULL
      AND description LIKE '%WA STATE DOL%';

-- ── 5. Add rules for newly discovered patterns ──────────────────────────────

INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-071', 'APPLECARD GSBANK', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-072', 'CITI AUTOPAY', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-073', 'BECU', 'cat-transfer', 5);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-074', 'BK OF AMER VISA', 'cat-transfer', 15);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-075', 'MILL CREEK KIDS', 'cat-childcare', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-076', 'YMCA', 'cat-health', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-077', 'WA STATE DOL', 'cat-transportation', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-078', 'FUNDRISE', 'cat-income', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-079', 'eCheck Deposit', 'cat-income', 10);
INSERT OR IGNORE INTO category_rules (id, pattern, category_id, priority)
    VALUES ('rule-080', 'JPMORGAN CHASE CHASE ACH PPD', 'cat-housing', 20);

-- 5a. Fix mortgage payments miscategorized as Transfer → Housing
UPDATE transactions SET category_id = 'cat-housing'
    WHERE description LIKE '%JPMORGAN CHASE CHASE ACH PPD%';

COMMIT;
