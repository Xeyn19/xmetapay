USE xmetapay_db;

CREATE TABLE IF NOT EXISTS tuition_payment_terms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_fee_assignment_id BIGINT UNSIGNED NOT NULL,
  term_name VARCHAR(120) NOT NULL,
  sort_order INT UNSIGNED NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status ENUM('open', 'partial', 'paid', 'cancelled') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tuition_terms_assignment_order (student_fee_assignment_id, sort_order),
  UNIQUE KEY uq_tuition_terms_assignment_name (student_fee_assignment_id, term_name),
  KEY idx_tuition_terms_assignment_status_due (student_fee_assignment_id, status, due_date),
  KEY idx_tuition_terms_status_due (status, due_date),
  CONSTRAINT fk_tuition_terms_assignment
    FOREIGN KEY (student_fee_assignment_id) REFERENCES student_fee_assignments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_term_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  tuition_payment_term_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payment_term_allocations_payment_term (payment_id, tuition_payment_term_id),
  KEY idx_payment_term_allocations_term (tuition_payment_term_id),
  CONSTRAINT fk_payment_term_allocations_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payment_term_allocations_term
    FOREIGN KEY (tuition_payment_term_id) REFERENCES tuition_payment_terms(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
