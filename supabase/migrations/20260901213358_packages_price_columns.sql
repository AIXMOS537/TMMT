-- Give packages a real price.
--
-- Applied to uapxakmlwnpfsftfeezx as 20260901213358.
--
-- Every figure in the resale ladder lived in the free-text `description`
-- column — '$1,875', '$3,750', … , '$35-50k'. Nothing could total, validate or
-- bill against it, a typo was invisible, and '$35-50k' is not a number at all.
--
-- Integer cents, matching the convention already used across this schema
-- (commission_cents, monthly_fee_cents, balance_cents). Floats are not used for
-- money here and should not start now.
--
-- price_max_cents is null for a fixed price and set only for a genuine range,
-- which is how '$35-50k' survives the move without being flattened to a guess.

alter table public.packages
  add column if not exists price_cents     integer,
  add column if not exists price_max_cents integer,
  add column if not exists currency        text not null default 'USD';

alter table public.packages
  drop constraint if exists packages_price_nonnegative;
alter table public.packages
  add constraint packages_price_nonnegative
  check (price_cents is null or price_cents >= 0);

-- A maximum without a minimum is meaningless, and a maximum below its minimum
-- is a data-entry error that should never reach a quote.
alter table public.packages
  drop constraint if exists packages_price_range_valid;
alter table public.packages
  add constraint packages_price_range_valid
  check (
    price_max_cents is null
    or (price_cents is not null and price_max_cents >= price_cents)
  );

-- Backfill from the descriptions they were trapped in.
update public.packages set price_cents =  187500 where slug = 'resale_airtable_starter';
update public.packages set price_cents =  375000 where slug = 'resale_airtable_pro';
update public.packages set price_cents =  750000 where slug = 'resale_airtable_automations';
update public.packages set price_cents = 1500000 where slug = 'resale_business_in_a_box';
update public.packages set price_cents = 2500000 where slug = 'resale_box_plus_car';
update public.packages
   set price_cents = 3500000, price_max_cents = 5000000
 where slug = 'resale_full_stack_max';

-- Clear the descriptions that held nothing but the price. Leaving them would
-- recreate the exact problem this migration exists to remove: two places
-- claiming to know what something costs, free to disagree.
update public.packages
   set description = null
 where slug like 'resale_%'
   and description ~ '^\$[0-9][0-9,.\-k$ ]*$';

comment on column public.packages.price_cents is
  'Authoritative price in cents. Low end of the range when price_max_cents is set. Never store price in description.';
comment on column public.packages.price_max_cents is
  'Upper bound for packages quoted as a range. Null for a fixed price.';
