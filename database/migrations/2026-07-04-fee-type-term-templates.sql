CREATE TABLE IF NOT EXISTS fee_type_term_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fee_type_id BIGINT UNSIGNED NOT NULL,
  term_name VARCHAR(120) NOT NULL,
  sort_order INT UNSIGNED NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_fee_type_term_templates_order (fee_type_id, sort_order),
  UNIQUE KEY uq_fee_type_term_templates_name (fee_type_id, term_name),
  KEY idx_fee_type_term_templates_fee_type (fee_type_id),
  CONSTRAINT fk_fee_type_term_templates_fee_type
    FOREIGN KEY (fee_type_id) REFERENCES fee_types(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
