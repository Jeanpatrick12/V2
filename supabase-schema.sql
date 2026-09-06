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
  lat                numeric,
  lng                numeric,
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
  is_demo            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Ajout de la colonne is_demo si la table existait deja avant son introduction
-- (2026-07-27) : marque une annonce comme fictive/de test, affichee avec un
-- badge "Démo" sur le site. Par defaut false, donc toute nouvelle annonce
-- deposee par un vrai utilisateur n'est jamais marquee demo automatiquement.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Coordonnees GPS (2026-07-28) : necessaires pour la vue carte de la page
-- annonces. Renseignees automatiquement (geocodage de l'adresse) au moment
-- du depot d'une nouvelle annonce - les annonces existantes qui n'ont pas
-- encore ces colonnes restent simplement absentes de la carte.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lng numeric;

-- ── Confiance pour les particuliers (2026-07-30) ──────────────────
-- Email verifie : synchronise automatiquement depuis auth.users a chaque
-- confirmation d'adresse email, affiche publiquement sur la fiche annonce
-- comme signal de confiance pour un vendeur particulier (pas seulement les
-- professionnels, qui avaient deja un badge "Verifie" base sur le SIRET).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_email_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET email_verified = (NEW.email_confirmed_at IS NOT NULL) WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_verified();

-- Rattrapage pour les comptes deja existants au moment de cette migration
UPDATE public.profiles p SET email_verified = (u.email_confirmed_at IS NOT NULL)
FROM auth.users u WHERE u.id = p.id;

-- Statistiques de reponse (taux de reponse + delai moyen), exposees via une
-- fonction publique qui ne renvoie que des chiffres agreges, jamais le
-- contenu des messages ni l'identite de l'acheteur.
CREATE OR REPLACE FUNCTION public.get_response_stats(target_user_id uuid)
RETURNS TABLE(response_rate numeric, avg_response_hours numeric, total_conversations bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH first_buyer_msg AS (
    SELECT m.conversation_id, MIN(m.created_at) AS buyer_first
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.seller_id = target_user_id AND m.sender_id IS DISTINCT FROM target_user_id AND m.sender_id IS NOT NULL
    GROUP BY m.conversation_id
  ),
  first_seller_reply AS (
    SELECT m.conversation_id, MIN(m.created_at) AS seller_first
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE c.seller_id = target_user_id AND m.sender_id = target_user_id
    GROUP BY m.conversation_id
  )
  SELECT
    CASE WHEN COUNT(fbm.conversation_id) = 0 THEN NULL
         ELSE ROUND(100.0 * COUNT(fsr.conversation_id) FILTER (WHERE fsr.seller_first > fbm.buyer_first) / COUNT(fbm.conversation_id), 0)
    END AS response_rate,
    ROUND(AVG(EXTRACT(EPOCH FROM (fsr.seller_first - fbm.buyer_first)) / 3600.0) FILTER (WHERE fsr.seller_first IS NOT NULL AND fsr.seller_first > fbm.buyer_first), 1) AS avg_response_hours,
    COUNT(fbm.conversation_id) AS total_conversations
  FROM first_buyer_msg fbm
  LEFT JOIN first_seller_reply fsr ON fsr.conversation_id = fbm.conversation_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_response_stats(uuid) TO anon, authenticated;

-- Compteur public de transactions abouties (ventes/locations), affiche sur
-- la page d'accueil comme preuve sociale. Contourne la RLS des listings
-- (qui cache les annonces 'sold' aux non-proprietaires) via SECURITY DEFINER,
-- mais ne renvoie jamais que deux chiffres agreges - aucune donnee d'annonce
-- individuelle. Les annonces demo (is_demo) sont exclues du decompte.
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE(sold_count bigint, rented_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (WHERE transaction = 'vente'    AND status = 'sold' AND NOT is_demo),
    COUNT(*) FILTER (WHERE transaction = 'location' AND status = 'sold' AND NOT is_demo)
  FROM public.listings;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

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

-- Active Supabase Realtime sur la table messages (2026-07-30), necessaire
-- pour que la messagerie affiche les nouveaux messages sans recharger la
-- page. Idempotent : ne fait rien si deja active.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ── 6. FAVORIS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  item_type  text NOT NULL DEFAULT 'listing' CHECK (item_type IN ('listing','pro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- ── 7. AVIS ──────────────────────────────────────────────────────
-- Avis laissés sur un professionnel, un vendeur/bailleur ou un
-- acheteur/locataire. Soumission libre (même sans compte, "auteur"
-- est un simple prénom déclaratif) ; modération manuelle via le
-- dashboard Supabase en passant "status" de 'pending' à 'approved'
-- (ou 'rejected') avant qu'un avis ne devienne public.
CREATE TABLE IF NOT EXISTS public.avis (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('pro','vendeur','acheteur','general')),
  target_id   text NOT NULL DEFAULT '',
  note        int  NOT NULL CHECK (note BETWEEN 1 AND 5),
  role        text NOT NULL DEFAULT '',
  titre       text,
  commentaire text NOT NULL,
  auteur      text NOT NULL DEFAULT 'Anonyme',
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 8. SIGNALEMENTS ─────────────────────────────────────────────
-- Signalement d'une annonce ou d'un profil professionnel suspect
-- (agence déguisée, etc.). Dépôt libre, traitement manuel via le
-- dashboard Supabase (passer "status" de 'pending' à 'traite').
CREATE TABLE IF NOT EXISTS public.signalements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL DEFAULT 'annonce' CHECK (type IN ('annonce','pro')),
  target      text NOT NULL DEFAULT '',
  raison      text NOT NULL,
  email       text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','traite')),
  created_at  timestamptz NOT NULL DEFAULT now()
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
ALTER TABLE public.avis         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

-- profiles : chacun ne lit/modifie que sa propre ligne (contient l'email, sensible).
-- Les autres profils sont exposés via la vue profiles_public ci-dessous (sans email).
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Vue publique : mêmes lignes que profiles, sans la colonne email.
-- Les vues Postgres s'exécutent avec les droits de leur propriétaire (souvent
-- postgres/admin) et contournent donc la RLS de la table sous-jacente — c'est
-- volontaire ici : c'est ce qui permet à tout le monde (y compris anonyme) de
-- lire prénom/nom/photo des autres utilisateurs malgré la policy restrictive
-- ci-dessus.
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, prenom, nom, photo, role, created_at, email_verified FROM public.profiles;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

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

-- avis : dépôt libre (même sans compte), lecture publique limitée aux avis approuvés
DROP POLICY IF EXISTS "avis_select" ON public.avis;
DROP POLICY IF EXISTS "avis_insert" ON public.avis;
CREATE POLICY "avis_select" ON public.avis FOR SELECT USING (status = 'approved');
CREATE POLICY "avis_insert" ON public.avis FOR INSERT WITH CHECK (true);

-- avis : modération réservée aux comptes profiles.role = 'admin' (page admin.html)
DROP POLICY IF EXISTS "avis_select_admin" ON public.avis;
DROP POLICY IF EXISTS "avis_update_admin" ON public.avis;
CREATE POLICY "avis_select_admin" ON public.avis FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "avis_update_admin" ON public.avis FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- signalements : dépôt réservé aux comptes connectés (pour éviter les signalements
-- abusifs anonymes), lecture réservée (aucune policy SELECT publique = personne
-- ne peut lire via l'API publique, seuls le dashboard Supabase et un compte
-- admin via admin.html y accèdent)
DROP POLICY IF EXISTS "signalements_insert" ON public.signalements;
CREATE POLICY "signalements_insert" ON public.signalements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "signalements_select_admin" ON public.signalements;
DROP POLICY IF EXISTS "signalements_update_admin" ON public.signalements;
CREATE POLICY "signalements_select_admin" ON public.signalements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "signalements_update_admin" ON public.signalements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

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

-- ── RECHERCHES SAUVEGARDEES + ALERTES EMAIL (2026-07-30) ──────────
-- Remplace le stockage localStorage des recherches sauvegardees : il
-- fallait une vraie table cote serveur pour qu'une fonction planifiee
-- puisse comparer les nouvelles annonces aux recherches de chaque
-- utilisateur et envoyer un email quand une correspondance apparait.
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT '',
  criteria     jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_alerts boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_searches_select" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_insert" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_update" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_delete" ON public.saved_searches;
CREATE POLICY "saved_searches_select" ON public.saved_searches FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "saved_searches_insert" ON public.saved_searches FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "saved_searches_update" ON public.saved_searches FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "saved_searches_delete" ON public.saved_searches FOR DELETE USING (user_id = auth.uid());

-- ── LEADS (2026-08-19) ─────────────────────────────────────────────
-- Capture les visiteurs pas encore prets a deposer une annonce (via un
-- petit formulaire email sur les pages guides/estimation). Ecriture
-- publique uniquement (comme un formulaire de contact) ; pas de lecture
-- publique, consultation depuis l'onglet Table Editor de Supabase ou via
-- le service_role. Un webhook Database (a configurer manuellement, voir
-- README plus bas) synchronise chaque nouveau lead vers Brevo.
CREATE TABLE IF NOT EXISTS public.leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  source     text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_unique ON public.leads (lower(email));
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (true);

-- ── MISE EN AVANT PAYANTE ("boosts") ──────────────────────────────
-- Ajoutée le 2026-09-05. Une annonce (vente ou location) mise en avant
-- remonte en tête des résultats de recherche et porte un badge "En avant"
-- jusqu'à featured_until. Paiement géré manuellement (virement, même
-- principe que la commission dans accord.html) : le propriétaire dépose une
-- demande depuis mes-annonces.html, un admin la confirme depuis admin.html
-- une fois le virement reçu, ce qui fixe featured_until.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_until timestamptz;

CREATE TABLE IF NOT EXISTS public.boost_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_days int  NOT NULL CHECK (duration_days IN (7,30)),
  amount_eur    numeric NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz
);
ALTER TABLE public.boost_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boost_requests_insert" ON public.boost_requests;
CREATE POLICY "boost_requests_insert" ON public.boost_requests FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "boost_requests_select_own" ON public.boost_requests;
CREATE POLICY "boost_requests_select_own" ON public.boost_requests FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "boost_requests_select_admin" ON public.boost_requests;
DROP POLICY IF EXISTS "boost_requests_update_admin" ON public.boost_requests;
CREATE POLICY "boost_requests_select_admin" ON public.boost_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "boost_requests_update_admin" ON public.boost_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- listings_update n'autorise que owner_id = auth.uid(), sans restriction de
-- colonne (RLS Postgres est ligne par ligne) : sans ce garde-fou, un
-- propriétaire pourrait s'attribuer lui-même featured_until en appelant
-- l'API directement, sans jamais passer par la confirmation d'un admin.
CREATE OR REPLACE FUNCTION public.protect_featured_until()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.featured_until IS DISTINCT FROM OLD.featured_until
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.featured_until := OLD.featured_until;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_featured_until ON public.listings;
CREATE TRIGGER trg_protect_featured_until BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_featured_until();

-- ── COMPTEUR DE VUES SUR LES ANNONCES ──────────────────────────────
-- Ajouté le 2026-09-05. Incrémenté via la fonction increment_listing_views
-- (SECURITY DEFINER) plutôt qu'un UPDATE direct : listings_update exige
-- owner_id = auth.uid(), donc un visiteur anonyme qui consulte l'annonce
-- de quelqu'un d'autre ne pourrait jamais faire ce +1 autrement.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_listing_views(p_listing_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.listings SET views_count = views_count + 1 WHERE id = p_listing_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated;

-- ── CONTACTS PROFESSIONNELS (suivi des demandes de devis) ──────────
-- Ajoutée le 2026-09-05. Remplace le mailto: direct sur la fiche pro :
-- chaque "Demander un devis" passe par ce formulaire, ce qui donne un
-- décompte fiable par professionnel (utile pour facturer une commission
-- sur les devis signés sans dépendre de la parole du partenaire).
-- Un webhook Database (INSERT) à configurer manuellement dans Supabase
-- déclenche la fonction notify-pro-contact qui relaie le message par email
-- au professionnel via Brevo (même principe que notify-message).
CREATE TABLE IF NOT EXISTS public.pro_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id       text NOT NULL,
  sender_name  text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  message      text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pro_contacts_insert" ON public.pro_contacts;
CREATE POLICY "pro_contacts_insert" ON public.pro_contacts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "pro_contacts_select_admin" ON public.pro_contacts;
CREATE POLICY "pro_contacts_select_admin" ON public.pro_contacts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── RÉCLAMATIONS DE COMMISSION (cashback client sur devis pro signé) ──
-- Ajoutée le 2026-09-05. Remplace le code SANSAGENTS5 (-5% instantané) :
-- le professionnel paie désormais 13% du contrat signé, dont 5% sont
-- reversés au particulier qui en fait la demande avec facture + preuve de
-- paiement à l'appui (contre 8% net conservé par SansAgents, comme avant).
-- reward_amount et pro_commission_amount sont calculés côté client au
-- moment de la demande (cf SA.computeCommissionReward) et rejoués/vérifiés
-- manuellement par l'admin avant tout virement — jamais de paiement
-- automatique.
CREATE TABLE IF NOT EXISTS public.commission_claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_id              text NOT NULL,
  claimant_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_amount     numeric NOT NULL CHECK (contract_amount > 0),
  reward_amount       numeric NOT NULL,
  pro_commission_amount numeric NOT NULL,
  invoice_path        text NOT NULL,
  payment_proof_path  text NOT NULL,
  iban                text NOT NULL,
  iban_holder_name    text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz
);
ALTER TABLE public.commission_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_claims_insert" ON public.commission_claims;
CREATE POLICY "commission_claims_insert" ON public.commission_claims FOR INSERT WITH CHECK (claimant_id = auth.uid());

DROP POLICY IF EXISTS "commission_claims_select_own" ON public.commission_claims;
CREATE POLICY "commission_claims_select_own" ON public.commission_claims FOR SELECT USING (claimant_id = auth.uid());

DROP POLICY IF EXISTS "commission_claims_select_admin" ON public.commission_claims;
DROP POLICY IF EXISTS "commission_claims_update_admin" ON public.commission_claims;
CREATE POLICY "commission_claims_select_admin" ON public.commission_claims FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "commission_claims_update_admin" ON public.commission_claims FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- BUCKET STORAGE — à créer MANUELLEMENT dans Supabase
--
-- Va dans Storage (menu de gauche) > New bucket
--   Nom    : listings-photos
--   Public : OUI (coche "Public bucket")
--
-- Cela permettra d'héberger les photos des annonces.
--
-- ─────────────────────────────────────────────────────────────────
-- Second bucket, à créer de la même façon :
--   Nom    : commission-proofs
--   Public : NON (laisse la case décochée)
--
-- Contient les factures et captures de virement envoyées avec une
-- réclamation de commission — des documents personnels/financiers, jamais
-- publics contrairement aux photos d'annonces. Une fois le bucket créé,
-- exécute les policies ci-dessous pour que chacun ne puisse déposer/lire
-- que ses propres fichiers (ou que l'admin lise tout, pour la vérification
-- des réclamations dans admin.html) :

DROP POLICY IF EXISTS "commission_proofs_insert" ON storage.objects;
CREATE POLICY "commission_proofs_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'commission-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "commission_proofs_select_own" ON storage.objects;
CREATE POLICY "commission_proofs_select_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'commission-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "commission_proofs_select_admin" ON storage.objects;
CREATE POLICY "commission_proofs_select_admin" ON storage.objects FOR SELECT
  USING (bucket_id = 'commission-proofs' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- ═══════════════════════════════════════════════════════════════════
