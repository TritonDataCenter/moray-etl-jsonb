CREATE TABLE array_test (
    json_array jsonb,
    id_array_1 varchar(18),
    id_array varchar(10) ARRAY,
    uuid_array_1 uuid,
    uuid_array uuid ARRAY,
    mac_array macaddr ARRAY,
    mac_array_1 macaddr,
    itime_array_1 timestamptz,
    itime_array timestamptz ARRAY,
    real_array_1 double precision,
    real_array double precision ARRAY
);