import sqlite3
conn = sqlite3.connect('patrol.db')

conn.execute('''CREATE TABLE IF NOT EXISTS drafts_new (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(256) NOT NULL,
    group_id VARCHAR(36),
    unit_id VARCHAR(36),
    status VARCHAR(32) DEFAULT "draft",
    content TEXT,
    category VARCHAR(32),
    problem_type VARCHAR(64),
    severity VARCHAR(16),
    evidence_summary TEXT,
    preliminary_reviewer VARCHAR(36),
    preliminary_review_comment TEXT,
    preliminary_review_at DATETIME,
    final_reviewer VARCHAR(36),
    final_review_comment TEXT,
    final_review_at DATETIME,
    approved_by VARCHAR(36),
    approved_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
)''')

conn.execute('INSERT INTO drafts_new SELECT * FROM drafts')
conn.execute('DROP TABLE drafts')
conn.execute('ALTER TABLE drafts_new RENAME TO drafts')
conn.commit()

cursor = conn.execute("PRAGMA table_info(drafts)")
print("After fix:")
for row in cursor.fetchall():
    print(f"  {row[1]}: notnull={row[3]}")
conn.close()
print("\n✅ drafts table fixed!")
