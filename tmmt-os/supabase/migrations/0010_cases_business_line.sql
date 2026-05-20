-- Business line on cases + intake (multi-brand command center)
alter table public.cases
  add column if not exists business_line text;

alter table public.customer_intake_forms
  add column if not exists business_line text;

create index if not exists cases_business_line_idx on public.cases(business_line);
create index if not exists customer_intake_business_line_idx on public.customer_intake_forms(business_line);

comment on column public.cases.business_line is 'TMMT operating line: rentals, express, black, auto, detailing, moving, cleaning, wholesale-cars, luxury, management';
