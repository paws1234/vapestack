-- The mirror's schema. Idempotent, so `tools/configure-mirror.sh` can run it against a database it
-- has already set up.
--
-- These tables are a *snapshot store*, not a second copy of the site that is queried. Nothing in
-- the live runtime reads them: the export writes here when the container stops, and hydration reads
-- from here when it starts. That is what keeps the site working when this database is paused,
-- unreachable or absent.
--
-- One row per snapshot, and one row per uploaded file inside it. The payloads are base64 on purpose
-- (see state.sh, rule 2): base64 contains no quotes, no backslashes and no newlines, so it crosses
-- psql's text output with nothing left to escape.

create table if not exists vapestack_snapshots (
	id             bigserial primary key,
	created_at     timestamptz not null default now(),
	-- A snapshot is only usable once its last row is written. Hydration filters on this, so an
	-- export that is interrupted by a full disk, a network drop or a `docker kill` cannot be
	-- restored over a good one.
	complete       boolean     not null default false,
	label          text,
	wp_version     text,
	site_url       text,
	table_count    integer,
	-- Uncompressed size of the dump, kept for reporting: db_dump is gzipped and base64-encoded, so
	-- its own length says nothing a person can use.
	db_bytes       bigint,
	db_dump        text,
	media_count    integer     not null default 0,
	media_bytes    bigint      not null default 0
);

-- "the newest complete snapshot" is the query hydration makes on every cold start.
create index if not exists vapestack_snapshots_complete_idx
	on vapestack_snapshots (complete, id desc);

create table if not exists vapestack_media (
	snapshot_id bigint  not null references vapestack_snapshots (id) on delete cascade,
	-- Path relative to wp-content/uploads, e.g. `2026/09/pm-al-fakher-1787317443.jpg`. Relative so
	-- a snapshot restores under whatever the uploads directory is on the machine rebuilding from it.
	path        text    not null,
	bytes       bigint  not null,
	sha256      text    not null,
	-- `{"b64": "..."}`. The object rather than the bare string leaves room to record anything else a
	-- file needs later without a migration.
	content     jsonb   not null,
	primary key (snapshot_id, path)
);

-- The mirror's own bookkeeping only ever grows downwards, and a snapshot that has been superseded
-- is dead weight of tens of megabytes, so state.sh prunes with this index in mind.
create index if not exists vapestack_media_snapshot_idx
	on vapestack_media (snapshot_id);

-- The deployed storefront's published copy of the catalogue.
--
-- The two tables above make a wiped WordPress machine rebuildable. This one is what stops the
-- deployed site needing that machine at all: a complete catalogue read is written here, and a read
-- that cannot reach WordPress is answered from here instead of showing an offline notice. Same
-- database and same connection string as the mirror, different consumer - and the shop's
-- photographs come out of `vapestack_media` above, which already holds every one of them.
--
-- One row, replaced in place, because only the newest copy is ever interesting. The key is versioned
-- by the code that writes it (`catalogue:v1`), so a document written against an older shape of the
-- GraphQL query is never read as though it were current.
create table if not exists vapestack_documents (
	key        text        primary key,
	document   jsonb       not null,
	item_count integer,
	source     text,
	updated_at timestamptz not null default now()
);
