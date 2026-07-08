-- IAP: deduplicate store transactions across retries

ALTER TABLE recharge_orders
  ADD COLUMN IF NOT EXISTS store_transaction_id VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recharge_store_tx
  ON recharge_orders(store_transaction_id)
  WHERE store_transaction_id IS NOT NULL;

INSERT INTO system_config (config_key, config_value) VALUES
  ('iap_products', '[
    {"id":"com.texasholdem.chips.100","chips":100,"priceCents":99,"label":{"zh-CN":"100 筹码","en-US":"100 Chips"}},
    {"id":"com.texasholdem.chips.500","chips":500,"priceCents":499,"label":{"zh-CN":"500 筹码","en-US":"500 Chips"}},
    {"id":"com.texasholdem.chips.1000","chips":1000,"priceCents":999,"label":{"zh-CN":"1000 筹码","en-US":"1000 Chips"}}
  ]')
ON CONFLICT (config_key) DO NOTHING;
