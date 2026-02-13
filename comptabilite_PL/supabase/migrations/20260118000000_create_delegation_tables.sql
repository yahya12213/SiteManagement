-- Migration: Create delegation tables for HR approval delegation system
-- Created: 2026-01-18
-- Purpose: Allow managers to delegate their approval authority to other users

-- ============================================
-- TABLE: hr_approval_delegations
-- ============================================
-- Stores delegation relationships where one user delegates approval authority to another

CREATE TABLE IF NOT EXISTS hr_approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delegate_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  delegation_type TEXT DEFAULT 'all' CHECK (delegation_type IN ('all', 'leave', 'overtime', 'correction')),
  excluded_employees TEXT[] DEFAULT '{}',
  max_amount NUMERIC(10, 2),
  reason TEXT,
  notes TEXT,
  requires_notification BOOLEAN DEFAULT TRUE,
  notification_sent_to_delegate BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT no_self_delegation CHECK (delegator_id != delegate_id)
);

-- ============================================
-- TABLE: hr_delegation_notifications
-- ============================================
-- Stores notifications sent regarding delegation creation/modification

CREATE TABLE IF NOT EXISTS hr_delegation_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES hr_approval_delegations(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('delegate_assigned', 'delegation_cancelled', 'delegation_expiring')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Performance indexes for delegations
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON hr_approval_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON hr_approval_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_dates ON hr_approval_delegations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON hr_approval_delegations(is_active) WHERE is_active = TRUE;

-- Performance indexes for notifications
CREATE INDEX IF NOT EXISTS idx_delegation_notifications_delegation ON hr_delegation_notifications(delegation_id);
CREATE INDEX IF NOT EXISTS idx_delegation_notifications_recipient ON hr_delegation_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_delegation_notifications_unread ON hr_delegation_notifications(recipient_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_hr_approval_delegations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hr_approval_delegations_updated_at
BEFORE UPDATE ON hr_approval_delegations
FOR EACH ROW
EXECUTE FUNCTION update_hr_approval_delegations_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE hr_approval_delegations IS 'Stores delegation relationships where managers delegate approval authority';
COMMENT ON COLUMN hr_approval_delegations.delegation_type IS 'Type of requests that can be approved: all, leave, overtime, or correction';
COMMENT ON COLUMN hr_approval_delegations.excluded_employees IS 'Array of employee IDs that are excluded from this delegation';
COMMENT ON COLUMN hr_approval_delegations.max_amount IS 'Maximum financial amount delegate can approve (for overtime with pay)';
COMMENT ON COLUMN hr_approval_delegations.is_active IS 'Whether delegation is active (can be cancelled before end_date)';

COMMENT ON TABLE hr_delegation_notifications IS 'Notifications sent to users about delegation events';
COMMENT ON COLUMN hr_delegation_notifications.notification_type IS 'Type: delegate_assigned, delegation_cancelled, delegation_expiring';
