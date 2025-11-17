-- Create work order counters table for atomic serial number generation
CREATE TABLE IF NOT EXISTS work_order_counters (
  type TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_serial INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (type, year)
);