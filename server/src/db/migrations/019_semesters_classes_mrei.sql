-- Two semesters a year, seven named classes, and the MREI name on new references.
-- Additive and safe on a database that already holds data: nothing is deleted and existing rows keep their values.

-- 1. Class names. Ihdaady = stage JSS, years 1 to 4; Thaanawiy = stage SSS, years 1 to 3. Existing JSS 1-3 become Ihdaady Awwal-Thaalith
--    and SSS 1 becomes Thaanawiy Awwal, in that order, with no data change. The arm (A, B...) follows the name after a space.
create or replace function class_label(stage school_stage, year int, arm text) returns text
language sql immutable as $$
  select case
    when stage = 'JSS' then (array['Ihdaady Awwal', 'Ihdaady Thaany', 'Ihdaady Thaalith', 'Ihdaady Raabih'])[year]
    else (array['Thaanawiy Awwal', 'Thaanawiy Thaaniy', 'Thaanawiy Thaalith'])[year]
  end || coalesce(' ' || arm, '')
$$;

alter table classes drop constraint if exists classes_year_check;
alter table classes add constraint classes_level_check
  check ((stage = 'JSS' and year between 1 and 4) or (stage = 'SSS' and year between 1 and 3));
alter table admission_applications drop constraint if exists admission_applications_class_year_check;
alter table admission_applications add constraint admission_applications_level_check
  check ((class_stage = 'JSS' and class_year between 1 and 4) or (class_stage = 'SSS' and class_year between 1 and 3));

-- 2. Semesters. If a database still has third-term rows (data from before this change) the limit is left alone so nothing is lost;
--    otherwise new sessions are held to two semesters by the database itself.
do $$
begin
  if not exists (select 1 from terms where term_number = 3) then
    alter table terms drop constraint if exists terms_term_number_check;
    alter table terms add constraint terms_term_number_check check (term_number between 1 and 2);
  end if;
end $$;

-- 3. New application references start with MREI. Existing KOK- references stay as they are and keep working.
alter table admission_applications alter column reference
  set default ('MREI-APP-' || lpad(nextval('application_number_seq')::text, 6, '0'));
