// sa-config.js — Remplissez les deux lignes ci-dessous
// (copiées depuis Supabase > Project Settings > API)
window.SA_CONFIG = {
  url:     "https://hnbxkiazozknxfhcplaw.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnhraWF6b3prbnhmaGNwbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzczNzUsImV4cCI6MjA5Nzk1MzM3NX0.P5DQEmtb1ie_cbNP_ESC3UDNHMAPTxU8byFWHtRLd-Q",
  // Cle API Geoapify (gratuite) : utilisee pour afficher les points d'interet
  // (ecoles, commerces, transports...) sur la carte des annonces.
  geoapifyKey: "ec26545074284f04a8a5f940f25eaa1f",
  // IBAN du compte SansAgents pour le reglement des commissions par virement
  // (affiche et copie depuis accord.html). A REMPLIR avec le vrai IBAN.
  iban: "FR76 XXXX XXXX XXXX XXXX XXXX XXX",
  // Offre de lancement : toute annonce publiee AVANT cette date est
  // definitivement exoneree de la commission de 1%, meme si la vente se
  // conclut apres cette date. Format AAAA-MM-JJ.
  // Regle imperative : cette date ne peut etre que reportee (repoussee dans
  // le temps), jamais avancee. Un utilisateur qui a publie sous l'offre de
  // lancement doit pouvoir en beneficier quoi qu'il arrive.
  commissionFreeUntil: "2027-02-01"
};
