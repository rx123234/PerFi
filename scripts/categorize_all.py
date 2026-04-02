import sqlite3
conn = sqlite3.connect(r'C:\Users\patri\AppData\Roaming\com.perfi.app\perfi.db')

rows = conn.execute('SELECT id, description FROM transactions WHERE category_id IS NULL').fetchall()
print(f'{len(rows)} to categorize')

rules = [
    ('cat-dining', ['TAQUERIA', 'TERIYAKI', 'THAI ', 'RAMEN', 'PHOREAL', 'NOODLE', 'WOK ',
        'BURGER', 'WINGS', 'DINER', 'BISTRO', 'BOBA', 'BREW', 'PUB ',
        'BAR ', 'TAVERN', 'CANTINA', 'STEAKHOUSE', 'SEAFOOD', 'DELI ',
        'SMOOTHIE', 'JUICE', 'CREPE', 'WAFFLE', 'DONUT', 'BAGEL',
        'SANDWICH', 'KITCHEN', 'FIVE GUYS', 'POPEYE', 'KFC ',
        'CHICK-FIL', 'JAMBA', 'DAIRY QUEEN', 'GOPUFF',
        'IVAR', 'GREAT HARVEST', 'FLYING SQUIRREL',
        'BOILING POINT', 'EZELL', 'MOD PIZZA', 'PAPA MURPHY',
        'SNOQUALMIE CASINO', 'TULALIP', 'TST*', 'SQ *', 'TOAST*',
        'CRUMBL', 'INSOMNIA COOKIE', 'DIN TAI FUNG', 'PHO',
        'CRAB', 'DUMPLING', 'GYRO', 'FALAFEL', 'SHAWARMA',
        'PANERA', 'SONIC DRIVE', 'MCDONALD', 'TACO BELL']),
    ('cat-groceries', ['GROCERY', 'MARKET', 'TRADER JOE', 'ALDI', 'WINCO', 'SPROUTS',
        'UWAJIMAYA', 'RANCH 99', 'MITSUWA', 'DAISO',
        'IC*', 'INSTACART', 'FRED MEY', 'FRANZ FAMILY', 'QFC', 'SAFEWAY']),
    ('cat-gas', ['SHELL OIL', 'ARCO ', 'CHEVRON', 'EXXON', '76 -', 'COSTCO GAS']),
    ('cat-shopping', ['MADEWELL', 'LULULEMON', 'UNIQLO', 'ZARA ', 'GAP ',
        'ANTHROPOLOGIE', 'POTTERY BARN', 'WEST ELM', 'IKEA',
        'ETSY', 'EBAY', 'POSHMARK', 'GAMESTOP', 'BESTBUY', 'BEST BUY',
        'VIDEO ONLY', 'NEOKYO', 'SP MEJURI', 'SP RANDOM GOLF', 'SP GOLF',
        'GOLFNOW', 'REMARKABLE', 'BAMBULAB', 'DICK', 'SP HELIX',
        'FLOWER', 'FLORAL', '1-800-FLOWER',
        'MARSHALLS', 'TJ MAXX', 'ROSS ', 'BURLINGTON', 'GOODWILL',
        'LOWES', 'HOME DEPOT', 'ACE HARDWARE', 'HARBOR FREIGHT',
        'MICHAELS', 'JOANN', 'STAPLES', 'PETCO', 'PETSMART',
        'WALGREENS', 'RITE AID', 'DOLLAR TREE', 'FIVE BELOW',
        'WORLD MARKET', 'ZAPPOS', 'HM.COM', 'SHEIN',
        'GREEN LAKE JEWELRY', 'NORDSTROM', 'OLD NAVY', 'OLDNAVY',
        'REI ', 'REI.COM', 'SUNSHINE HAIR', 'FRANCES GRACE',
        'LITTLE RED DAY SPA', 'SALON', 'SPA ',
        'SEPHORA', 'ULTA', 'BATH &']),
    ('cat-entertainment', ['GOLF', 'BOWLING', 'ARCADE', 'CINEMA', 'MOVIE', 'THEATER',
        'MUSEUM', 'ZOO', 'AQUARIUM', 'SKI ', 'TOPGOLF',
        'TICKETMASTER', 'STUBHUB', 'EVENTBRITE', 'FANDANGO',
        'BANDON DUNES', 'HOME COURSE', 'COLUMBIA SUPER',
        'EXPERIENCE MOMENTUM', 'PR GLOBAL', 'ARENA SPORTS',
        'TRAMPOLINE', 'ESCAPE ROOM', 'CPP*',
        'CREATIVE HANDS']),
    ('cat-transportation', ['PARKING', 'HERTZ', 'ENTERPRISE RENT', 'AVIS',
        'ALASKA AIR', 'DELTA AIR', 'UNITED AIR', 'SOUTHWEST', 'JETBLUE',
        'WSDOT', 'GOODTOGO', 'TOLL', 'TOYOTA',
        'JIFFY LUBE', 'VALVOLINE', 'TIRE',
        'CHASE TRAVEL', 'EXPEDIA', 'AIRBNB', 'HOTEL',
        'SEATAC', 'UBER', 'LYFT']),
    ('cat-health', ['DOCTOR', 'DENTAL', 'DENTIST', 'CLINIC', 'MEDICAL',
        'HOSPITAL', 'URGENT CARE', 'LABCORP', 'VISION', 'OPTICAL',
        'GYM', 'FITNESS', 'PELOTON', 'IHERB',
        'MILL CREEK FA', 'FLORES & ASSOCIA', 'NAVIA']),
    ('cat-subscriptions', ['OPENAI', 'CHATGPT', 'CLAUDE', 'MIDJOURNEY',
        'NOTION', 'FIGMA', 'CANVA', 'ADOBE', 'MICROSOFT',
        'GOOGLE STORAGE', 'ICLOUD', 'DROPBOX', 'GITHUB',
        'YOUTUBE', 'PARAMOUNT', 'HBO', 'PEACOCK', 'CRUNCHYROLL',
        'AUDIBLE', 'KINDLE', 'READING.COM',
        'PATREON', 'ANNUAL MEMBERSHIP', 'MEMBERSHIP FEE',
        'HIYA HEALTH', 'SP HIYA']),
    ('cat-housing', ['PLUMBER', 'ELECTRICIAN', 'HVAC', 'ROOFING', 'LANDSCAP',
        'LAWN', 'GARDEN', 'ADVANCED GARAGE', 'HANDYMAN',
        'CLEANER', 'PEST CONTROL']),
    ('cat-transfer', ['ALLIANZ', 'INSURANCE', 'GEICO', 'STATE FARM',
        'SCHWAB BROKERAGE', 'FID BKG SVC', 'TITAN GLOBAL',
        'ATM CASH', 'CASH DEPOSIT',
        'ALLY BANK', 'CHECK PAID',
        'PAYMENT THANK YOU', 'ONLINE PAYMENT',
        'IRS USATAXPYMT', 'AUTOPAY 9999']),
    ('cat-childcare', ['DAYCARE', 'PRESCHOOL', 'TUTOR', 'KUMON']),
]

categorized = 0
for tx_id, desc in rows:
    text = desc.upper()
    matched = False
    for cat_id, keywords in rules:
        for kw in keywords:
            if kw.upper() in text:
                conn.execute('UPDATE transactions SET category_id = ? WHERE id = ?', (cat_id, tx_id))
                categorized += 1
                matched = True
                break
        if matched:
            break

conn.commit()
remaining = conn.execute('SELECT COUNT(*) FROM transactions WHERE category_id IS NULL').fetchone()[0]
print(f'Categorized: {categorized}')
print(f'Still uncategorized: {remaining}')

if remaining > 0:
    leftovers = conn.execute('''
        SELECT description, ABS(amount_cents)/100.0
        FROM transactions WHERE category_id IS NULL
        ORDER BY ABS(amount_cents) DESC LIMIT 30
    ''').fetchall()
    print('\nRemaining:')
    for r in leftovers:
        print(f'  {r[0][:65]:65s} | ${r[1]:>8,.2f}')
conn.close()
