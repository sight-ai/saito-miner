CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS
$$
DECLARE
    _new record;
BEGIN
    _new := NEW;
    _new.updated_at = NOW();
    RETURN _new;
END;
$$
LANGUAGE plpgsql;

CREATE SCHEMA IF NOT EXISTS saito_miner;

-------------------------------------------------
------------------ saito_miner -------------------
-------------------------------------------------

CREATE TABLE saito_miner.tasks (
    id                   text PRIMARY KEY,
    model                text NOT NULL,
    created_at           timestamp NOT NULL DEFAULT now(),
    status               text NOT NULL,
    total_duration       double precision,
    load_duration        double precision,
    prompt_eval_count    integer,
    prompt_eval_duration double precision,
    eval_count           integer,
    eval_duration        double precision,
    updated_at           timestamp NOT NULL DEFAULT now(),
    source               text NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'gateway'))
);

CREATE TABLE saito_miner.earnings ( 
    id text PRIMARY KEY,
    block_rewards double precision NOT NULL DEFAULT 0,
    job_rewards double precision NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'gateway'))
);

CREATE TABLE saito_miner.device_status (
    name text NOT NULL,
    status text NOT NULL,
    device_id text NOT NULL,
    up_time_start timestamp,
    up_time_end timestamp,
    reward_address text,
    gateway_address text,
    key text,
    code text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);


CREATE TABLE saito_miner.chat_records (
    id                   text PRIMARY KEY,
    user_id              text NOT NULL,
    user_input           text NOT NULL,
    ai_response          text NOT NULL,
    created_at           timestamp NOT NULL DEFAULT now(),
    updated_at           timestamp NOT NULL DEFAULT now(),
    status               text NOT NULL, 
    conversation_id      text,
    metadata             jsonb,
    task_id              text,  -- Add the task_id column for the foreign key relationship
    FOREIGN KEY (task_id) REFERENCES saito_miner.tasks(id)  -- Define the foreign key relationship
);


CREATE TRIGGER set_timestamp_earnings
    BEFORE UPDATE ON saito_miner.earnings
    FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_timestamp_device_status
    BEFORE UPDATE ON saito_miner.device_status
    FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();


CREATE TRIGGER set_timestamp_chat_records
    BEFORE UPDATE ON saito_miner.chat_records
    FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();