-- FlockLedger: full PostgreSQL schema (Alembic revisions 001 + 002).
-- Source: run `alembic upgrade head --sql` or this checked-in copy.
-- Usage: psql "$DATABASE_URL" -f sql/full_schema_postgres.sql
--        (empty database only — drops not included)

BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- 001_initial_schema

CREATE TABLE users (
    id SERIAL NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE farms (
    id SERIAL NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(512),
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE INDEX ix_farms_owner_id ON farms (owner_id);

CREATE TABLE farm_members (
    id SERIAL NOT NULL,
    user_id INTEGER NOT NULL,
    farm_id INTEGER NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_farm_member_user_farm UNIQUE (user_id, farm_id)
);

CREATE INDEX ix_farm_members_farm_id ON farm_members (farm_id);
CREATE INDEX ix_farm_members_user_id ON farm_members (user_id);

CREATE TABLE sheds (
    id SERIAL NOT NULL,
    farm_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    bird_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id)
);

CREATE INDEX ix_sheds_farm_id ON sheds (farm_id);

CREATE TABLE egg_production (
    id SERIAL NOT NULL,
    shed_id INTEGER NOT NULL,
    date DATE NOT NULL,
    eggs_produced INTEGER NOT NULL,
    broken_eggs INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (shed_id) REFERENCES sheds (id),
    CONSTRAINT uq_egg_production_shed_date UNIQUE (shed_id, date)
);

CREATE INDEX ix_egg_production_date ON egg_production (date);
CREATE INDEX ix_egg_production_shed_id ON egg_production (shed_id);

CREATE TABLE feed_inventory (
    id SERIAL NOT NULL,
    farm_id INTEGER NOT NULL,
    feed_received NUMERIC(12, 2) NOT NULL,
    feed_used NUMERIC(12, 2) NOT NULL,
    feed_remaining NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id)
);

CREATE INDEX ix_feed_inventory_date ON feed_inventory (date);
CREATE INDEX ix_feed_inventory_farm_id ON feed_inventory (farm_id);

CREATE TABLE sales (
    id SERIAL NOT NULL,
    farm_id INTEGER NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,
    trays_sold INTEGER NOT NULL,
    rate_per_tray NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id)
);

CREATE INDEX ix_sales_date ON sales (date);
CREATE INDEX ix_sales_farm_id ON sales (farm_id);

CREATE TABLE expenses (
    id SERIAL NOT NULL,
    farm_id INTEGER NOT NULL,
    category VARCHAR(128) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (farm_id) REFERENCES farms (id)
);

CREATE INDEX ix_expenses_date ON expenses (date);
CREATE INDEX ix_expenses_farm_id ON expenses (farm_id);

INSERT INTO alembic_version (version_num) VALUES ('001');

-- 002_audit_logs

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
