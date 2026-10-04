-- 001: platform settings + admin capabilities seed baseline
INSERT INTO settings(id, value) VALUES ('platform', jsonb_build_object(
  'zone', 'Damak',
  'rewardPerNpr100', 1,
  'redeemPoints', 100,
  'redeemDiscountPaisa', 5000,
  'milestoneBookings', 5,
  'milestoneBonus', 100,
  'quotesRequireAdminApproval', true,
  'quotesApprovalThresholdPaisa', 500000,
  'cookiePolicyVersion', 'v1',
  'consentVersion', 1
)) ON CONFLICT (id) DO NOTHING;
