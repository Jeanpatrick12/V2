-- ═══════════════════════════════════════════════════════════════════
-- SansAgents — Schéma PostgreSQL pour Supabase
--
-- Comment utiliser ce fichier :
--   1. Connecte-toi sur https://supabase.com et ouvre ton projet
--   2. Clique sur « SQL Editor » dans le menu de gauche
--   3. Colle tout ce fichier dans l'éditeur et clique « Run »
--   4. C'est tout — toutes les tables, règles de sécurité et
--      fonctions sont créées automatiquement.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. PROFILS UTILISATEURS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom     text NOT NULL,
  nom        text NOT NULL DEFAULT '',
  email      text NOT NULL,
  photo      text,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Crée automatiquement un profil dès qu'un utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, prenom, nom)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'nom', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. ANNONCES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type               text NOT NULL CHECK (type IN ('maison','appartement','studio','loft')),
  transaction        text NOT NULL CHECK (transaction IN ('vente','location')),
  title              text NOT NULL DEFAULT '',
  ville              text NOT NULL DEFAULT '',
  postal             text NOT NULL DEFAULT '',
  adresse            text NOT NULL DEFAULT '',
  price              numeric NOT NULL,
  charges            numeric NOT NULL DEFAULT 0,
  surface            numeric NOT NULL,
  pieces             int,
  chambres           int,
  sdb                int,
  dpe                char(1),
  ges                char(1),
  facture_energie    numeric,
  meuble             text,
  etage              int,
  annee_construction int,
  etat_general       text,
  terrain            numeric,
  niveaux_maison     text,
  hauteur_plafond    numeric,
  origine_batiment   text,
  chauffage_mode     text,
  source_energie     text,
  chauffage          text,
  eau_chaude         text,
  config_maison      text,
  img                text,
  photos             jsonb NOT NULL DEFAULT '[]',
  plans              jsonb NOT NULL DEFAULT '[]',
  equipements        jsonb NOT NULL DEFAULT '[]',
  description        text NOT NULL DEFAULT '',
  contact_prenom     text NOT NULL DEFAULT '',
  contact_nom        text NOT NULL DEFAULT '',
  contact_email      text NOT NULL DEFAULT '',
  contact_tel        text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ── 3. PROFESSIONNELS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pros (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name       text NOT NULL,
  job        text NOT NULL,
  cat        text NOT NULL CHECK (cat IN ('immobilier','travaux')),
  city       text NOT NULL DEFAULT '',
  zone       text NOT NULL DEFAULT '',
  siret      text NOT NULL CHECK (siret ~ '^\d{14}$'),
  phone      text NOT NULL DEFAULT '',
  email      text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  long_desc  text NOT NULL DEFAULT '',
  services   jsonb NOT NULL DEFAULT '[]',
  rating     numeric NOT NULL DEFAULT 0,
  reviews    int NOT NULL DEFAULT 0,
  color      text NOT NULL DEFAULT '#E84533',
  icon       text NOT NULL DEFAULT 'ti-briefcase',
  logo       text,
  verified   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. CONVERSATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id           text NOT NULL,
  listing_title        text NOT NULL DEFAULT '',
  contact_name         text NOT NULL DEFAULT '',
  contact_shared       boolean NOT NULL DEFAULT false,
  buyer_confirmed_sale boolean NOT NULL DEFAULT false,
  buyer_confirmed_at   timestamptz,
  buyer_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at      timestamptz,
  last_read_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── 5. MESSAGES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_role       text NOT NULL CHECK (from_role IN ('me','other','system')),
  sender_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  text            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Bloque les numéros de téléphone et e-mails dans les messages (côté serveur)
CREATE OR REPLACE FUNCTION public.check_message_contact_info()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.text ~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}' THEN
    RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'
      USING HINT = 'Le message contient une adresse e-mail.';
  END IF;
  IF NEW.text ~ '(\+33|0033|0)\s*[1-9]([\s.\-]?\d{2}){4}' THEN
    RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'
      USING HINT = 'Le message contient un numéro de téléphone.';
  END IF;
  IF length(regexp_replace(NEW.text, '[^0-9]', '', 'g')) >= 9 THEN
    RAISE EXCEPTION 'CONTACT_INFO_BLOCKED'
      USING HINT = 'Le message semble contenir un numéro de téléphone.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_message_insert ON public.messages;
CREATE TRIGGER before_message_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_message_contact_info();

-- ── 6. FAVORIS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  item_type  text NOT NULL DEFAULT 'listing' CHECK (item_type IN ('listing','pro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- ═══════════════════════════════════════════════════════════════════
-- SÉCURITÉ (Row Level Security)
-- Ces règles garantissent que chaque utilisateur ne voit et ne
-- modifie que ce qu'il a le droit de voir/modifier.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pros         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites    ENABLE ROW LEVEL SECURITY;

-- profiles : tout le monde peut lire, chacun modifie le sien
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- listings : annonces actives visibles de tous, vendues visibles du proprio seulement
DROP POLICY IF EXISTS "listings_select" ON public.listings;
DROP POLICY IF EXISTS "listings_insert" ON public.listings;
DROP POLICY IF EXISTS "listings_update" ON public.listings;
DROP POLICY IF EXISTS "listings_delete" ON public.listings;
CREATE POLICY "listings_select" ON public.listings FOR SELECT
  USING (status = 'active' OR owner_id = auth.uid());
CREATE POLICY "listings_insert" ON public.listings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());
CREATE POLICY "listings_update" ON public.listings FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "listings_delete" ON public.listings FOR DELETE
  USING (owner_id = auth.uid());

-- pros : lecture publique, insertion auth seulement, modif par proprio ou admin
DROP POLICY IF EXISTS "pros_select" ON public.pros;
DROP POLICY IF EXISTS "pros_insert" ON public.pros;
DROP POLICY IF EXISTS "pros_update" ON public.pros;
CREATE POLICY "pros_select" ON public.pros FOR SELECT USING (true);
CREATE POLICY "pros_insert" ON public.pros FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pros_update" ON public.pros FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- conversations : uniquement les participants
DROP POLICY IF EXISTS "convos_select" ON public.conversations;
DROP POLICY IF EXISTS "convos_insert" ON public.conversations;
DROP POLICY IF EXISTS "convos_update" ON public.conversations;
CREATE POLICY "convos_select" ON public.conversations FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "convos_insert" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND buyer_id = auth.uid());
CREATE POLICY "convos_update" ON public.conversations FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- messages : uniquement les participants de la conversation
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- favorites : chacun voit et gère les siennes
DROP POLICY IF EXISTS "favorites_select" ON public.favorites;
DROP POLICY IF EXISTS "favorites_insert" ON public.favorites;
DROP POLICY IF EXISTS "favorites_delete" ON public.favorites;
CREATE POLICY "favorites_select" ON public.favorites FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "favorites_insert" ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "favorites_delete" ON public.favorites FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- FONCTION SÉCURISÉE : coordonnées d'une annonce
-- Renvoie le téléphone et l'e-mail d'une annonce UNIQUEMENT si
-- l'acheteur a une conversation avec contactShared = true,
-- ou s'il est le propriétaire de l'annonce.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_listing_contact(p_listing_id text)
RETURNS TABLE(contact_tel text, contact_email text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.contact_tel, l.contact_email
  FROM public.listings l
  WHERE l.id::text = p_listing_id
    AND (
      l.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.listing_id = p_listing_id
          AND c.buyer_id = auth.uid()
          AND c.contact_shared = true
      )
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- BUCKET STORAGE — à créer MANUELLEMENT dans Supabase
--
-- Va dans Storage (menu de gauche) > New bucket
--   Nom    : listings-photos
--   Public : OUI (coche "Public bucket")
--
-- Cela permettra d'héberger les photos des annonces.
-- ═══════════════════════════════════════════════════════════════════
