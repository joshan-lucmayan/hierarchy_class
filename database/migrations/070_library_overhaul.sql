-- Library overhaul: book location, requested loan days, and overdue fines.
--
-- 1. library_books.location
--      Where the book physically sits in the library (e.g. "Shelf A2, Rack 3"),
--      shown on the book detail + in notifications so students can find it.
-- 2. library_borrow_requests.requested_days
--      How many days the student asked to keep the book. Approval uses this
--      instead of the old hardcoded 14 days.
-- 3. library_borrow_log.due_date
--      Due date captured on the "borrowed" event, so fines/receipts stay
--      accurate after the book's own borrow fields are cleared on return.
-- 4. library_borrow_log.overdue_days + fine_amount
--      Overdue fine levied on the "returned" event:
--      max(0, return_date - due_date) days x 10 pesos per day.

ALTER TABLE library_books ADD COLUMN IF NOT EXISTS location TEXT;

ALTER TABLE library_borrow_requests ADD COLUMN IF NOT EXISTS requested_days INT DEFAULT 7;

ALTER TABLE library_borrow_log ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE library_borrow_log ADD COLUMN IF NOT EXISTS overdue_days INT DEFAULT 0;
ALTER TABLE library_borrow_log ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10, 2) DEFAULT 0;
