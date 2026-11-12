create table if not exists holds (
    id bigserial primary key,
    reservation_id uuid not null,
    show_id int not null,
    seat int not null,
    held_at timestamptz not null default now()
);

create unique index if not exists holds_reservation_seat on holds (reservation_id, seat);
