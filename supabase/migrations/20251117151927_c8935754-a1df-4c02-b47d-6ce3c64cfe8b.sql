-- Add serial, year, and order_code columns to work_orders
ALTER TABLE work_orders 
  ADD COLUMN serial INTEGER,
  ADD COLUMN year INTEGER,
  ADD COLUMN order_code TEXT;

-- Create unique index to ensure serial uniqueness per type+year
CREATE UNIQUE INDEX idx_work_orders_type_year_serial 
  ON work_orders(type, year, serial);

-- Create index on order_code for fast lookups
CREATE INDEX idx_work_orders_order_code ON work_orders(order_code);