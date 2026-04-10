-- FlockLedger: audit_logs only (Alembic 002).
-- Use when the database already has revision 001 applied (alembic_version = '001'
-- or schema matches 001 without audit_logs).
-- After running: UPDATE alembic_version SET version_num = '002';
-- Or: alembic stamp 002

BEGIN;

CREATE TABLE audit_logs (
    id SERIAL NOT NULL,
    farm_id INTEGER,
    user_id INTEGER NOT NULL,
    action VARCHAR(32) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id INTEGER,
    detail_json TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX ix_audit_logs_farm_id ON audit_logs (farm_id);
CREATE INDEX ix_audit_logs_resource_id ON audit_logs (resource_id);
CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);

UPDATE alembic_version SET version_num = '002' WHERE alembic_version.version_num = '001';

COMMIT;
