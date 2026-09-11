-- Increment discovered count for a given date
create or replace function increment_discovered(p_date date, p_count integer)
returns void as $$
begin
  insert into daily_stats (date, discovered, target)
  values (p_date, p_count, 50)
  on conflict (date) do update
  set discovered = daily_stats.discovered + p_count;
end;
$$ language plpgsql;

-- Increment applied count for a given date and category
create or replace function increment_applied(p_date date, p_category text)
returns void as $$
begin
  insert into daily_stats (date, applied, target)
  values (p_date, 1, 50)
  on conflict (date) do update
  set
    applied = daily_stats.applied + 1,
    sales_applied = daily_stats.sales_applied + case when p_category = 'sales' then 1 else 0 end,
    govcon_applied = daily_stats.govcon_applied + case when p_category = 'govcon' then 1 else 0 end,
    datacenter_applied = daily_stats.datacenter_applied + case when p_category = 'datacenter' then 1 else 0 end;
end;
$$ language plpgsql;
