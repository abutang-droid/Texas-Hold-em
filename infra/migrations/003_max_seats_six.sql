-- v1: tables are 6-max only (official + private)
ALTER TABLE private_rooms DROP CONSTRAINT IF EXISTS private_rooms_max_seats_check;
ALTER TABLE private_rooms ADD CONSTRAINT private_rooms_max_seats_check CHECK (max_seats BETWEEN 2 AND 6);
UPDATE private_rooms SET max_seats = 6 WHERE max_seats > 6;
