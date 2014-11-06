CREATE TABLE lastfm_flat_m (
    _m_id uuid,
    artist varchar(214),
    similars jsonb,
    tags jsonb,
    timestamp timestamptz,
    title varchar(174),
    track_id varchar(18)
);