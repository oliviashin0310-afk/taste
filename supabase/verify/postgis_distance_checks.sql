-- Run after enabling PostGIS and applying the migrations.
-- Confirms X/Y coordinate order and the inclusive meter thresholds used by ST_DWithin.
do $$
declare
  origin extensions.geography := extensions.st_setsrid(
    extensions.st_makepoint(126.9780, 37.5665), 4326
  )::extensions.geography;
  check_radius double precision;
begin
  if extensions.st_x(origin::extensions.geometry) <> 126.9780
     or extensions.st_y(origin::extensions.geometry) <> 37.5665 then
    raise exception 'Coordinate order check failed: expected X=longitude and Y=latitude';
  end if;

  foreach check_radius in array array[500.0, 1000.0, 3000.0] loop
    if not extensions.st_dwithin(origin, extensions.st_project(origin, check_radius - 1, 0), check_radius) then
      raise exception 'Inside-radius check failed for % meters', check_radius;
    end if;
    if extensions.st_dwithin(origin, extensions.st_project(origin, check_radius + 1, 0), check_radius) then
      raise exception 'Outside-radius check failed for % meters', check_radius;
    end if;
  end loop;
end;
$$;
