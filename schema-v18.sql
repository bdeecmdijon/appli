-- ── schema-v18 : Ajout quantité aux coupons ───────────────────────────────
-- 1. Colonne quantity (nullable, null = illimité)
-- 2. use_coupon mis à jour avec vérification de stock

-- ── 1. ALTER TABLE ──────────────────────────────────────────────────────────

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS quantity INT;

-- ── 2. RPC : use_coupon (avec vérification out_of_stock) ───────────────────

CREATE OR REPLACE FUNCTION use_coupon(p_user_id uuid, p_assignment_id uuid)
RETURNS json AS $$
DECLARE
  v_asgn       coupon_assignments%ROWTYPE;
  v_coupon     coupons%ROWTYPE;
  v_token      text;
  v_used_count int;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_asgn
  FROM coupon_assignments
  WHERE id = p_assignment_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_asgn.status = 'used' THEN
    RETURN json_build_object('error', 'already_used');
  END IF;

  SELECT * INTO v_coupon FROM coupons WHERE id = v_asgn.coupon_id;

  IF v_coupon.expires_at < now() THEN
    UPDATE coupon_assignments SET status = 'expired' WHERE id = p_assignment_id;
    RETURN json_build_object('error', 'expired');
  END IF;

  IF v_coupon.available_from > now() THEN
    RETURN json_build_object('error', 'not_yet_available');
  END IF;

  -- Vérification du stock (si quantity n'est pas NULL)
  IF v_coupon.quantity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used_count
    FROM coupon_assignments
    WHERE coupon_id = v_coupon.id AND status = 'used';

    IF v_used_count >= v_coupon.quantity THEN
      RETURN json_build_object('error', 'out_of_stock');
    END IF;
  END IF;

  -- Réutilise le QR s'il est encore valide (5 min pas écoulées)
  IF v_asgn.qr_code IS NOT NULL AND v_asgn.qr_expires_at > now() THEN
    RETURN json_build_object(
      'success',    true,
      'qr_code',    v_asgn.qr_code,
      'expires_at', v_asgn.qr_expires_at,
      'title',      v_coupon.title,
      'emoji',      v_coupon.emoji
    );
  END IF;

  -- Génère un token unique : préfixe CPN + 16 hex = 19 chars
  LOOP
    v_token := 'CPN' || upper(encode(gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM coupon_assignments WHERE qr_code = v_token);
  END LOOP;

  UPDATE coupon_assignments
  SET qr_code       = v_token,
      qr_expires_at = now() + interval '5 minutes'
  WHERE id = p_assignment_id;

  RETURN json_build_object(
    'success',    true,
    'qr_code',    v_token,
    'expires_at', now() + interval '5 minutes',
    'title',      v_coupon.title,
    'emoji',      v_coupon.emoji
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
